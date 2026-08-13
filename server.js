require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();
app.get('/', (req, res) => { res.status(200).send('Maligai WhatsApp Bot is running!'); });
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || "maligai-demo-token";

// Product catalog
const products = {
  rice: {
    name: "Ponni Rice",
    unit: "kg",
    price: 70,
  },
  sugar: {
    name: "Sugar",
    unit: "kg",
    price: 50,
  },
  oil: {
    name: "Sunflower Oil",
    unit: "litre",
    price: 150,
  },
  dal: {
    name: "Toor Dal",
    unit: "kg",
    price: 140,
  },
};

// Core reply logic
function makeReply(text) {
  const v = String(text || "").toLowerCase().trim();

  if (v.includes("offer")) {
    return `🔥 Today's Offers

5 kg Ponni Rice – ₹330
1 kg Sugar – ₹48
1 L Sunflower Oil – ₹145

Reply with the quantity you want.`;
  }

  if (v.includes("status")) {
    return `📦 Order #1042

Status: Out for delivery 🚚
Expected: Today 6:00–7:00 PM`;
  }

  const items = [];

  const kgMatches = v.matchAll(
    /(\d+(?:\.\d+)?)\s*kg\s*(rice|sugar|dal)/g
  );

  for (const m of kgMatches) {
    const qty = Number(m[1]);
    const key = m[2];
    const product = products[key];

    items.push({
      qty,
      unit: product.unit,
      name: product.name,
      amount: qty * product.price,
    });
  }

  const oilMatch = v.match(
    /(\d+(?:\.\d+)?)\s*(?:litre|liter|l)\s*oil/
  );

  if (oilMatch) {
    const qty = Number(oilMatch[1]);
    const product = products.oil;

    items.push({
      qty,
      unit: product.unit,
      name: product.name,
      amount: qty * product.price,
    });
  }

  if (items.length > 0) {
    const total = items.reduce((sum, item) => sum + item.amount, 0);

    const lines = items
      .map(
        (item) =>
          `${item.qty} ${item.unit} ${item.name} – ₹${item.amount}`
      )
      .join("\n");

    return `🧾 Your Order

${lines}

----------------
Total: ₹${total}

Reply YES to confirm.`;
  }

  if (v === "yes" || v.includes("confirm")) {
    return `✅ Order confirmed!

Order ID: #1043

We will pack your items and update you shortly.`;
  }

  if (v.includes("rice") || v.includes("price")) {
    return `🍚 Ponni Rice: ₹70/kg

Available: 25 kg

Example:
2 kg rice`;
  }

  return `Vanakkam! 👋

I can help with:

🛒 Grocery orders
💰 Prices
🔥 Offers
📦 Order status

Try:

2 kg rice, 1 kg sugar, 1 litre oil`;
}

// Function to send reply via WhatsApp API
async function sendWhatsAppReply(to, text) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.error("Missing WhatsApp credentials in .env");
    return;
  }

  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      },
    });
    console.log(`✅ Reply sent to ${to}`);
  } catch (error) {
    console.error(
      "❌ Error sending reply:",
      error.response?.data || error.message
    );
  }
}

// Health check
app.get("/", (req, res) => {
  res.json({
    app: "Maligai WhatsApp AI Demo",
    status: "running",
    webhook: "/webhook",
  });
});

// WhatsApp webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// WhatsApp webhook receiver — NOW WITH REPLY!
app.post("/webhook", async (req, res) => {
  console.log(
    "📩 Incoming webhook:",
    JSON.stringify(req.body, null, 2)
  );

  // Acknowledge receipt immediately (WhatsApp expects 200)
  res.sendStatus(200);

  // Process asynchronously so we don't block
  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Ignore if not a text message
    if (!message || message.type !== "text") {
      return;
    }

    const from = message.from; // sender's WhatsApp number
    const text = message.text.body;

    console.log(`💬 Message from ${from}: "${text}"`);

    // Generate reply
    const replyText = makeReply(text);

    // Send it back
    await sendWhatsAppReply(from, replyText);
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
  }
});

// Local testing endpoint
app.post("/api/chat", (req, res) => {
  const message = req.body?.message || "";
  const reply = makeReply(message);

  res.json({
    ok: true,
    message,
    reply,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Maligai backend running on port ${PORT}`);
});
