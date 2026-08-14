const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

// Read environment variables
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.use(express.json());

// 1. Root Route (Health check)
app.get('/', (req, res) => {
  res.status(200).send('Bot is active');
});

// 2. Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 Verification Request Received');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Meta Verified the URL');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 3. Incoming Message (And Automatic Reply)
app.post('/webhook', async (req, res) => {
  const body = req.body;
  
  console.log('📩 META DATA RECEIVED (Check this!):');
  console.log(JSON.stringify(body, null, 2));

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;
    const message = value.messages ? value.messages[0] : null;

    if (message && message.type === 'text') {
      const userNumber = message.from;
      const userText = message.text.body;
      
      console.log(`💬 Incoming: ${userText} from ${userNumber}`);

      try {
        // Step 4: Reply back using the Sandbox API
        const response = await axios({
          method: 'POST',
          url: `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, // Updated to v21.0
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          data: {
            messaging_product: 'whatsapp',
            to: userNumber,
            type: 'text',
            text: { body: `Reply: You said "${userText}"` }
          }
        });
        
        console.log('✅ Reply sent!');
      } catch (error) {
        console.log('❌ Error in Reply:', error.response ? error.response.data : error.message);
      }
    }
  }

  // Always return 200
  res.sendStatus(200);
});

// 4. Debug Route - Fix Webhook Subscription
app.get('/fix-webhook', async (req, res) => {
  try {
    const r = await axios.post(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/subscribe`,
      { messaging_product: 'whatsapp' },
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );
    console.log('✅ Webhook subscription fixed');
    res.json({ success: true, data: r.data });
  } catch (e) {
    console.log('❌ Error fixing webhook:', e.response?.data || e.message);
    res.json({ error: e.response?.data || e.message });
  }
});

// 5. Debug Route - Check Subscription
app.get('/check-subscription', async (req, res) => {
  try {
    const r = await axios.get(
      `https://graph.facebook.com/v21.0/1078837787819850/subscribed_apps`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );
    res.json(r.data);
  } catch (e) {
    res.json(e.response ? e.response.data : { error: e.message });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Bot active on port ${port}`);
});
