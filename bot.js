const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// Gemini API Key එක මෙතනට දාලා තියෙන්නේ
const genAI = new GoogleGenerativeAI("AQ.Ab8RN6LIlSq3cQzinO0juxQdmktRcCMxS8zvVGAKYAiu0k5P6g");

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
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
            console.log(`මැසේජ් එකක් ආවා: ${messageText}`);

            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `You are a helpful and accurate weather and general assistant bot specifically for Sri Lanka. User asked: "${messageText}". Provide a clear, natural, and helpful response in Sinhala or English based on the user's language. If it relates to weather in Sri Lanka (like rain, temperature, Colombo, Kandy, etc.), give smart guidance.`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                await sock.sendMessage(sender, { text: responseText });
            } catch (error) {
                console.error('Error:', error);
                await sock.sendMessage(sender, { text: "කණගාටුයි, කාලගුණ තොරතුරු ලබා ගැනීමේදී දෝෂයක් සිදු විය." });
            }
        }
    });
}

connectToWhatsApp();
