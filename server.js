require("dotenv").config();

const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || "maligai-demo-token";

const products = {
  rice: {
    name: "Ponni Rice",
    unit: "kg",
    price: 70
  },
  sugar: {
    name: "Sugar",
    unit: "kg",
    price: 50
  },
  oil: {
    name: "Sunflower Oil",
    unit: "litre",
    price: 150
  },
  dal: {
    name: "Toor Dal",
    unit: "kg",
    price: 140
  }
};

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
      amount: qty * product.price
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
      amount: qty * product.price
    });
  }

  if (items.length > 0) {
    const total = items.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const lines = items
      .map(
        item =>
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


// Home / health check
app.get("/", (req, res) => {
  res.json({
    app: "Maligai WhatsApp AI Demo",
    status: "running",
    webhook: "/webhook"
  });
});


// WhatsApp webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});


// WhatsApp webhook receiver
app.post("/webhook", (req, res) => {
  console.log(
    "WhatsApp webhook:",
    JSON.stringify(req.body, null, 2)
  );

  res.sendStatus(200);
});


// Local testing
app.post("/api/chat", (req, res) => {
  const message = req.body?.message || "";

  const reply = makeReply(message);

  res.json({
    ok: true,
    message,
    reply
  });
});


app.listen(PORT, () => {
  console.log(
    `Maligai backend running on port ${PORT}`
  );
});
