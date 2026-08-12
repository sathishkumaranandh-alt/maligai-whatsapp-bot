const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

// ============================================
// 0. உங்கள் WhatsApp எண் (இங்கே மாற்றவும்)
// ============================================
// +91 9876543210 என்றால் → '919876543210' என்று எழுதவும்
const BOT_PHONE_NUMBER = '91XXXXXXXXXX'; 

// ============================================
// 1. மாலிகை ஸ்டோர் - தமிழ் பொருட்கள் பட்டியல்
// ============================================
const PRODUCTS = [
    { code: 'R001', name: 'பாஸ்மதி அரிசி (1கி.கி)', cat: 'அரிசி', price: 120, stock: 50 },
    { code: 'R002', name: 'சோனா மசூரி (5கி.கி)', cat: 'அரிசி', price: 250, stock: 30 },
    { code: 'S001', name: 'மஞ்சள் பொடி (100கி)', cat: 'மசாலா', price: 25, stock: 80 },
    { code: 'S002', name: 'மிளகாய் பொடி (100கி)', cat: 'மசாலா', price: 30, stock: 75 },
    { code: 'P001', name: 'துவரம் பருப்பு (1கி.கி)', cat: 'பருப்பு', price: 95, stock: 40 },
    { code: 'P002', name: 'பாசிப் பருப்பு (1கி.கி)', cat: 'பருப்பு', price: 85, stock: 45 },
    { code: 'O001', name: 'சூரியகாந்தி எண்ணெய் (1லி)', cat: 'எண்ணெய்', price: 130, stock: 35 },
    { code: 'T001', name: 'தேநீர் பொடி (250கி)', cat: 'தேநீர்', price: 60, stock: 45 },
    { code: 'J001', name: 'வெள்ளை சர்க்கரை (1கி.கி)', cat: 'சர்க்கரை', price: 45, stock: 55 },
];

function getProduct(code) {
    return PRODUCTS.find(p => p.code === code.toUpperCase());
}

// ============================================
// 2. போட் லாஜிக் (தமிழ் மெனு, கூடை, ஆர்டர்)
// ============================================
const sessions = {};

function getSession(phone) {
    if (!sessions[phone]) {
        sessions[phone] = { state: 'menu', cart: [], orders: [] };
    }
    return sessions[phone];
}

function processBot(phone, text) {
    const session = getSession(phone);
    const msg = text.trim();
    const lower = msg.toLowerCase();

    if (session.state === 'menu') {
        if (['hi', 'hello', 'menu', 'start'].includes(lower)) {
            return `🪴 *மாலிகை ஸ்டோருக்கு வரவேற்கிறோம்!* 🪴

1️⃣ பொருட்களை பார்வையிடு 📦 (1)
2️⃣ பொருட்களை தேடு 🔍 (2)
3️⃣ கூடையை பார் 🛒 (3)
4️⃣ எனது ஆர்டர்கள் 📋 (4)
5️⃣ உதவி & ஆதரவு ℹ️ (5)

தயவுசெய்து 1-5 என்ற எண்ணை தட்டச்சு செய்யவும்.`;
        }
        else if (msg === '1') {
            session.state = 'browse';
            return `📦 *பொருட்களின் வகைகள்:*

1. அரிசி & தானியங்கள்
2. மசாலா பொருட்கள்
3. பருப்பு வகைகள்
4. எண்ணெய் & நெய்
5. தேநீர் & காபி

வகை எண்ணை தட்டச்சு செய்யவும் (1-5)
அல்லது BACK - முந்தைய மெனு`;
        }
        else if (msg === '2') {
            session.state = 'search';
            return `🔍 *பொருட்களை தேடு*

தயவுசெய்து நீங்கள் தேடும் பொருளின் பெயரை தட்டச்சு செய்யவும்.`;
        }
        else if (msg === '3') {
            return showCart(session);
        }
        else if (msg === '4') {
            return showOrders(session);
        }
        else if (msg === '5' || lower === 'help') {
            return `🤖 *உதவி & ஆதரவு*

• MENU - முதன்மை மெனு
• ADD குறியீடு அளவு - கூடையில் சேர்க்க (எ.கா: ADD R001 2)
• CHECKOUT - ஆர்டர் செய்ய
• CLEAR - கூடையை காலி செய்ய
• BACK - முந்தைய மெனு

📞 தொடர்பு: +91-9876543210`;
        }
        else {
            return "❌ தவறான தேர்வு. தயவுசெய்து 1-5 அல்லது 'MENU' என்று தட்டச்சு செய்யவும்.";
        }
    }
    else if (session.state === 'browse') {
        if (msg.toUpperCase() === 'BACK') {
            session.state = 'menu';
            return "முதன்மை மெனுவிற்கு திரும்பியது. 'MENU' என்று தட்டச்சு செய்யவும்.";
        }
        if (msg.toUpperCase().startsWith('ADD')) {
            return addToCart(msg, session);
        }
        const catMap = {
            '1': 'அரிசி & தானியங்கள்', '2': 'மசாலா பொருட்கள்', '3': 'பருப்பு வகைகள்',
            '4': 'எண்ணெய் & நெய்', '5': 'தேநீர் & காபி'
        };
        const catName = catMap[msg];
        if (catName) {
            const items = PRODUCTS.filter(p => p.cat === catName);
            let res = `🛍️ *${catName}*\n\n`;
            items.forEach(p => {
                res += `• ${p.name} - ₹${p.price} (குறியீடு: ${p.code})\n`;
            });
            res += `\nகூடையில் சேர்க்க: ADD குறியீடு அளவு (எ.கா: ADD R001 2)`;
            return res;
        }
        return "❌ தவறான வகை எண். 1-5 அல்லது BACK என்று தட்டச்சு செய்யவும்.";
    }
    else if (session.state === 'search') {
        const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(msg.toLowerCase()));
        if (results.length === 0) {
            return `❌ '${msg}' உடன் பொருந்தக்கூடிய பொருட்கள் இல்லை. \n'BACK' அல்லது 'MENU' என்று தட்டச்சு செய்யவும்.`;
        }
        let res = `🔍 *தேடல் முடிவுகள்:*\n\n`;
        results.slice(0, 5).forEach(p => {
            res += `• ${p.name} - ₹${p.price} (குறியீடு: ${p.code})\n`;
        });
        res += `\nகூடையில் சேர்க்க: ADD குறியீடு அளவு`;
        return res;
    }
    else if (session.state === 'cart') {
        if (msg.toUpperCase() === 'CHECKOUT') {
            if (session.cart.length === 0) return "❌ கூடை காலியாக உள்ளது.";
            session.state = 'checkout';
            return `📍 *விநியோக விவரங்களை உள்ளிடவும்:*

பெயர்: [உங்கள் பெயர்]
முகவரி: [உங்கள் முகவரி]
தொலைபேசி: [உங்கள் எண்]

*அல்லது 'BACK' என்று தட்டச்சு செய்து ரத்து செய்யவும்.*`;
        }
        else if (msg.toUpperCase() === 'CLEAR') {
            session.cart = [];
            return "🗑️ கூடை காலி செய்யப்பட்டது!";
        }
        else if (msg.toUpperCase() === 'BACK') {
            session.state = 'menu';
            return "முதன்மை மெனுவிற்கு திரும்பியது.";
        }
        return showCart(session);
    }
    else if (session.state === 'checkout') {
        if (msg.toUpperCase() === 'BACK') {
            session.state = 'menu';
            return "ஆர்டர் ரத்து செய்யப்பட்டது.";
        }
        const lines = msg.split('\n');
        const info = {};
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join(':').trim();
                info[key] = val;
            }
        });

        if (info['பெயர்'] && info['முகவரி']) {
            let total = 0;
            session.cart.forEach(item => {
                total += item.product.price * item.qty;
            });
            const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
            session.orders.push({
                id: orderId,
                name: info['பெயர்'],
                address: info['முகவரி'],
                total: total,
                date: new Date().toLocaleString()
            });
            session.cart = [];
            session.state = 'menu';
            return `✅ *ஆர்டர் உறுதிப்படுத்தப்பட்டது!*

📋 ஆர்டர் ஐடி: #${orderId}
💰 மொத்தம்: ₹${total}
📍 முகவரி: ${info['முகவரி']}

24 மணி நேரத்திற்குள் விநியோகிக்கப்படும்.
'MENU' என்று தட்டச்சு செய்து தொடர்ந்து வாங்கவும்.`;
        } else {
            return "❌ பெயர் மற்றும் முகவரி கட்டாயமாகும். சரியான வடிவத்தில் உள்ளிடவும்.";
        }
    }
    else if (session.state === 'orders') {
        if (msg.toUpperCase() === 'BACK' || msg.toUpperCase() === 'MENU') {
            session.state = 'menu';
            return "முதன்மை மெனுவிற்கு திரும்பியது.";
        }
        return showOrders(session);
    }
    return "❌ ஏதோ பிழை ஏற்பட்டது. 'MENU' என்று தட்டச்சு செய்யவும்.";
}

function addToCart(msg, session) {
    const parts = msg.split(' ');
    if (parts.length < 2) return "❌ சரியான வடிவம்: ADD குறியீடு அளவு (எ.கா: ADD R001 2)";
    const code = parts[1].toUpperCase();
    const qty = parseInt(parts[2]) || 1;
    const product = getProduct(code);
    if (!product) return "❌ தவறான பொருள் குறியீடு.";
    if (product.stock < qty) return `❌ கையிருப்பில் ${product.stock} மட்டுமே உள்ளது.`;
    const existing = session.cart.find(item => item.product.code === code);
    if (existing) {
        existing.qty += qty;
    } else {
        session.cart.push({ product, qty });
    }
    return `✅ ${qty}x ${product.name} கூடையில் சேர்க்கப்பட்டது!`;
}

function showCart(session) {
    if (session.cart.length === 0) return "🛒 கூடை காலியாக உள்ளது.";
    let res = "🛒 *உங்கள் கூடை*\n\n";
    let total = 0;
    session.cart.forEach(item => {
        const subtotal = item.product.price * item.qty;
        total += subtotal;
        res += `• ${item.product.name} x${item.qty} = ₹${subtotal}\n`;
    });
    res += `\n💰 *மொத்தம்: ₹${total}*`;
    res += `\n\n'CHECKOUT' - ஆர்டர் செய்ய\n'CLEAR' - காலி செய்ய\n'BACK' - மெனுவிற்கு`;
    return res;
}

function showOrders(session) {
    if (session.orders.length === 0) return "📭 இதுவரை ஆர்டர் செய்யவில்லை.";
    let res = "📋 *உங்கள் ஆர்டர்கள்*\n\n";
    session.orders.slice().reverse().forEach(order => {
        res += `• #${order.id} - ₹${order.total} (${order.date})\n`;
    });
    res += "\n'BACK' அல்லது 'MENU' மூலம் திரும்பவும்.";
    return res;
}

// ============================================
// 3. Baileys இணைப்பு (Pairing Code முறையில்)
// ============================================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // QR ஐ அச்சிட வேண்டாம்
    });

    let pairingRequested = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;
        
        // QR வந்தால், அதற்கு பதிலாக Pairing Code (PIN) உருவாக்கு
        if (qr && !pairingRequested) {
            pairingRequested = true;
            console.log('\n📱 QR ஐ ஸ்கேன் செய்ய முடியாததால், Pairing Code (PIN) உருவாக்கப்படுகிறது...');
            try {
                const code = await sock.requestPairingCode(BOT_PHONE_NUMBER);
                console.log('\n🔑 உங்கள் 6-இலக்க PIN குறியீடு:');
                console.log('=========================================');
                console.log(`              ${code}`);
                console.log('=========================================');
                console.log('\n📝 இந்த PIN ஐ WhatsApp-ல் எவ்வாறு உள்ளிடுவது:');
                console.log('1. WhatsApp -> Settings (அமைப்புகள்) -> Linked Devices (இணைக்கப்பட்ட சாதனங்கள்)');
                console.log('2. "Link with Phone Number" (அல்லது "Link a Device") என்பதைத் தட்டவும்.');
                console.log('3. உங்கள் மொபைல் எண்ணை உள்ளிட்டு, கீழே உள்ள PIN-ஐ உள்ளிடவும்.');
                console.log('\n✅ இணைப்பு வெற்றியடைந்ததும், போட் தானாகவே இயங்கத் தொடங்கும்!\n');
            } catch (err) {
                console.error('Pairing code error:', err);
                pairingRequested = false;
            }
        }

        if (connection === 'open') {
            console.log('\n✅ WhatsApp இணைப்பு வெற்றி! போட் தயார்!\n');
        }
        if (connection === 'close') {
            console.log('⚠️ இணைப்பு துண்டிக்கப்பட்டது. மீண்டும் இணைக்க முயற்சிக்கிறேன்...');
            setTimeout(startBot, 5000);
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
        const reply = processBot(phone, text);
        await sock.sendMessage(msg.key.remoteJid, { text: reply });
    });
}

console.log('🚀 மாலிகை ஸ்டோர் போட் தொடங்குகிறது...');
startBot();
