const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// Render එකට වෙබ් සර්වර් පොට් එකක් දීම
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('WhatsApp Weather Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Gemini API Key එක
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyD... (උඹේ කී එක)"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'open') {
            console.log('✅ WhatsApp Weather Bot එක සාර්ථකව Connect වුණා!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (messageText) {
            console.log(`📩 ලැබුණු ප්‍රශ්නය: ${messageText}`);

            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `You are a helpful and accurate weather and general assistant bot specifically for Sri Lanka. Answer this: ${messageText}`;
                
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                await sock.sendMessage(sender, { text: responseText });
            } catch (error) {
                console.error('Error:', error);
                await sock.sendMessage(sender, { text: "සමාවෙන්න, යම්කිසි දෝෂයක් සිදු විය. කරුණාකර පසු මොහොතක උත්සාහ කරන්න." });
            }
        }
    });
}

connectToWhatsApp();
