// Maligai List WhatsApp Bot - Webhook Server
// Receives customer messages, parses with Claude, replies + notifies store owner

const express = require("express");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;           // your own secret, e.g. "maligai123"
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;         // from Meta dashboard
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;       // from Meta dashboard (API Setup tab)
const STORE_OWNER_NUMBER = process.env.STORE_OWNER_NUMBER; // store owner's WhatsApp number, e.g. "919876543210"
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ---------- STEP 1: Meta webhook verification (GET) ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------- STEP 2: Receive incoming messages (POST) ----------
app.post("/webhook", async (req, res) => {
  // Always respond 200 fast so Meta doesn't retry/timeout
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || message.type !== "text") return; // ignore non-text (status updates etc.)

    const customerNumber = message.from;         // sender's WhatsApp number
    const text = message.text.body;               // the maligai list text

    console.log(`Message from ${customerNumber}: ${text}`);

    // ---------- STEP 3: Parse with Claude ----------
    const parsed = await parseGroceryList(text);

    // ---------- STEP 4: Reply to customer ----------
    await sendWhatsAppMessage(customerNumber, parsed.note);

    // ---------- STEP 5: Notify store owner ----------
    if (STORE_OWNER_NUMBER) {
      const orderSlip = formatOrderSlip(parsed.items, customerNumber);
      await sendWhatsAppMessage(STORE_OWNER_NUMBER, orderSlip);
    }
  } catch (err) {
    console.error("Error handling message:", err);
  }
});

// ---------- Helper: Call Claude to extract structured items ----------
async function parseGroceryList(rawText) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are parsing a grocery ("maligai") order for a small South Indian kirana store. The customer wrote (mix of English/Tamil/Tanglish is normal):\n\n"${rawText}"\n\nReturn ONLY strict JSON, no markdown fences, no preamble, matching this shape exactly:\n{"items":[{"name":"string (clean, capitalized product name, translate Tamil to English if needed, keep it short)","qty":"string like '5 kg' or '2 pcs' or '250 g'"}],"note":"one short friendly confirmation line to send back to the customer, in Tanglish (Tamil+English mix), max 20 words"}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  const cleaned = (textBlock?.text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ---------- Helper: Send a WhatsApp text message via Cloud API ----------
async function sendWhatsAppMessage(toNumber, bodyText) {
  await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toNumber,
      type: "text",
      text: { body: bodyText },
    }),
  });
}

// ---------- Helper: Format the order slip for the store owner ----------
function formatOrderSlip(items, customerNumber) {
  const lines = items.map((it) => `• ${it.name} — ${it.qty}`).join("\n");
  return `🛒 New order from +${customerNumber}\n\n${lines}`;
}

app.get("/", (req, res) => res.send("Maligai WhatsApp bot is running."));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
