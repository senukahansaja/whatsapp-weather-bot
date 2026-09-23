const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('WhatsApp Weather Bot is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    // Pairing Code එක Request කිරීම
    if (!sock.authState.creds.registered) {
        // ⚠️ මෙතන 94 සමඟ ඔයාගේ නම්බර් එක දෙන්න (+ ලකුණ නැතුව)
        const phoneNumber = "94702634347"; 

        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`====================================`);
            console.log(`👉 YOUR PAIRING CODE: ${code}`);
            console.log(`====================================`);
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ WhatsApp Weather Bot සාර්ථකව Connect විය!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (messageText) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const prompt = `You are a helpful weather and general assistant bot. Answer briefly: ${messageText}`;
                
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                await sock.sendMessage(sender, { text: responseText });
            } catch (error) {
                console.error('Error:', error);
                await sock.sendMessage(sender, { text: 'කණගාටුයි, යම් දෝෂයක් සිදු විය.' });
            }
        }
    });
}

connectToWhatsApp();
