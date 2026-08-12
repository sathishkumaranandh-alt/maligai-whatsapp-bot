const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

// ============================================
// 0. உங்கள் WhatsApp எண் (முக்கியம்!)
// ============================================
// +91 9876543210 என்றால் '919876543210' என்று எழுதவும்
const BOT_PHONE_NUMBER = '91XXXXXXXXXX'; // இங்கே உங்கள் எண்ணைச் சரி செய்யவும்!

// ============================================
// 1. மாலிகை ஸ்டோர் - பொருட்கள் பட்டியல்
// ============================================
const PRODUCTS = [
    { code: 'R001', name: 'பாஸ்மதி அரிசி (1கி.கி)', cat: 'அரிசி', price: 120, stock: 50 },
    { code: 'S001', name: 'மஞ்சள் பொடி (100கி)', cat: 'மசாலா', price: 25, stock: 80 },
    { code: 'P001', name: 'துவரம் பருப்பு (1கி.கி)', cat: 'பருப்பு', price: 95, stock: 40 },
];

function getProduct(code) {
    return PRODUCTS.find(p => p.code === code.toUpperCase());
}

// ============================================
// 2. போட் லாஜிக் (முந்தையது போலவே)
// ============================================
const sessions = {};

function getSession(phone) {
    if (!sessions[phone]) sessions[phone] = { state: 'menu', cart: [], orders: [] };
    return sessions[phone];
}

function processBot(phone, text) {
    const session = getSession(phone);
    const msg = text.trim();
    const lower = msg.toLowerCase();

    if (session.state === 'menu') {
        if (['hi', 'hello', 'menu', 'start'].includes(lower)) {
            return `🪴 மாலிகை ஸ்டோருக்கு வரவேற்கிறோம்!\n\n1️⃣ பொருட்கள் 📦\n2️⃣ தேடு 🔍\n3️⃣ கூடை 🛒\n4️⃣ ஆர்டர்கள் 📋\n5️⃣ உதவி ℹ️`;
        } else if (msg === '1') {
            session.state = 'browse';
            return `📦 வகைகள்:\n1. அரிசி & தானியங்கள்\n2. மசாலா\n3. பருப்பு\n\nBACK - முந்தைய மெனு`;
        } else if (msg === '2') {
            session.state = 'search';
            return `🔍 தேட வேண்டிய பெயரை எழுதவும்.`;
        } else if (msg === '3') {
            return showCart(session);
        } else if (msg === '4') {
            return showOrders(session);
        } else if (msg === '5' || lower === 'help') {
            return `🤖 உதவி: MENU, ADD குறியீடு அளவு, CHECKOUT, CLEAR`;
        } else {
            return "❌ தவறான தேர்வு. 1-5 அல்லது MENU தட்டச்சு செய்யவும்.";
        }
    }
    else if (session.state === 'browse') {
        if (msg.toUpperCase() === 'BACK') { session.state = 'menu'; return "முதன்மை மெனுவிற்கு திரும்பியது."; }
        if (msg.toUpperCase().startsWith('ADD')) return addToCart(msg, session);
        const catMap = { '1': 'அரிசி & தானியங்கள்', '2': 'மசாலா', '3': 'பருப்பு' };
        const items = PRODUCTS.filter(p => p.cat === catMap[msg]);
        if (items.length) {
            let res = `🛍️ ${catMap[msg]}:\n`;
            items.forEach(p => res += `\n• ${p.name} - ₹${p.price} (${p.code})`);
            return res + `\n\nADD குறியீடு அளவு (எ.கா: ADD R001 2)`;
        }
        return "❌ தவறான வகை எண்.";
    }
    else if (session.state === 'search') {
        const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(msg.toLowerCase()));
        if (!results.length) return `❌ '${msg}' பொருட்கள் இல்லை.`;
        let res = `🔍 முடிவுகள்:\n`;
        results.slice(0, 5).forEach(p => res += `\n• ${p.name} - ₹${p.price} (${p.code})`);
        return res + `\n\nADD குறியீடு அளவு`;
    }
    else if (session.state === 'cart') {
        if (msg.toUpperCase() === 'CHECKOUT') {
            if (!session.cart.length) return "❌ கூடை காலியாக உள்ளது.";
            session.state = 'checkout';
            return `📍 விநியோக விவரங்கள்:\n\nபெயர்: [பெயர்]\nமுகவரி: [முகவரி]`;
        } else if (msg.toUpperCase() === 'CLEAR') {
            session.cart = [];
            return "🗑️ கூடை காலி செய்யப்பட்டது.";
        } else if (msg.toUpperCase() === 'BACK') {
            session.state = 'menu';
            return "மெனுவிற்கு திரும்பியது.";
        }
        return showCart(session);
    }
    else if (session.state === 'checkout') {
        if (msg.toUpperCase() === 'BACK') { session.state = 'menu'; return "ஆர்டர் ரத்து."; }
        const info = {};
        msg.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) info[parts[0].trim()] = parts.slice(1).join(':').trim();
        });
        if (info['பெயர்'] && info['முகவரி']) {
            let total = 0;
            session.cart.forEach(item => total += item.product.price * item.qty);
            const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
            session.orders.push({ id: orderId, name: info['பெயர்'], address: info['முகவரி'], total, date: new Date().toLocaleString() });
            session.cart = [];
            session.state = 'menu';
            return `✅ ஆர்டர் உறுதி!\nID: #${orderId}\nமொத்தம்: ₹${total}\nமுகவரி: ${info['முகவரி']}\n\n24 மணி நேரத்தில் விநியோகம்.`;
        }
        return "❌ பெயர் மற்றும் முகவரி கட்டாயம்.";
    }
    return "❌ பிழை. MENU தட்டச்சு செய்யவும்.";
}

function addToCart(msg, session) {
    const parts = msg.split(' ');
    if (parts.length < 2) return "❌ ADD குறியீடு அளவு (ADD R001 2)";
    const prod = getProduct(parts[1].toUpperCase());
    if (!prod) return "❌ தவறான குறியீடு.";
    const qty = parseInt(parts[2]) || 1;
    if (prod.stock < qty) return `❌ கையிருப்பில் ${prod.stock} மட்டுமே.`;
    const existing = session.cart.find(item => item.product.code === prod.code);
    if (existing) existing.qty += qty;
    else session.cart.push({ product: prod, qty });
    return `✅ ${qty}x ${prod.name} சேர்க்கப்பட்டது!`;
}

function showCart(session) {
    if (!session.cart.length) return "🛒 கூடை காலியாக உள்ளது.";
    let res = "🛒 கூடை:\n";
    let total = 0;
    session.cart.forEach(item => {
        const st = item.product.price * item.qty;
        total += st;
        res += `\n• ${item.product.name} x${item.qty} = ₹${st}`;
    });
    return res + `\n\n💰 மொத்தம்: ₹${total}\n\nCHECKOUT - ஆர்டர்\nCLEAR - காலி\nBACK - மெனு`;
}

function showOrders(session) {
    if (!session.orders.length) return "📭 ஆர்டர்கள் இல்லை.";
    let res = "📋 உங்கள் ஆர்டர்கள்:\n";
    session.orders.slice().reverse().forEach(o => res += `\n• #${o.id} - ₹${o.total} (${o.date})`);
    return res;
}

// ============================================
// 3. Baileys இணைப்பு - மேம்படுத்தப்பட்டது (Stable)
// ============================================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
    });

    let pairingRequested = false;
    let reconnectTimer = null;

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        // இணைப்பு வெற்றி பெற்றால்
        if (connection === 'open') {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            console.log('\n✅ WhatsApp இணைப்பு வெற்றி! போட் தயார்!\n');
            return;
        }

        // QR / PIN தேவைப்பட்டால்
        if (qr && !pairingRequested) {
            pairingRequested = true;
            console.log('\n📱 PIN உருவாக்கப்படுகிறது...');
            try {
                const code = await sock.requestPairingCode(BOT_PHONE_NUMBER);
                console.log('\n🔑 உங்கள் 6-இலக்க PIN குறியீடு:');
                console.log('=========================================');
                console.log(`              ${code}`);
                console.log('=========================================');
                console.log('\n📝 இந்த PIN ஐ உள்ளிடவும்:');
                console.log('1. WhatsApp → Settings → Linked Devices');
                console.log('2. "Link with Phone Number"');
                console.log('3. உங்கள் எண் & PIN ஐ உள்ளிடவும்.\n');
            } catch (err) {
                console.error('PIN பிழை:', err.message);
                pairingRequested = false;
            }
            return;
        }

        // இணைப்பு துண்டிக்கப்பட்டால்
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === 401) {
                console.log('⚠️ அமர்வு ரத்து செய்யப்பட்டது. மீண்டும் ஸ்கேன் செய்யவும்.');
                return;
            }

            console.log(`⚠️ இணைப்பு துண்டிக்கப்பட்டது. 15 வினாடிகளில் மீண்டும் முயற்சிக்கிறேன்...`);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
                console.log('🔄 மீண்டும் இணைக்க முயற்சிக்கிறேன்...');
                startBot();
            }, 15000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;
        const phone = msg.key.remoteJid.split('@')[0];
        console.log(`📩 பெறப்பட்டது: ${phone} -> ${text}`);
        await sock.sendMessage(msg.key.remoteJid, { text: processBot(phone, text) });
    });
}

console.log('🚀 மாலிகை ஸ்டோர் போட் தொடங்குகிறது...');
startBot();
