
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

// Read environment variables from Render
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.use(express.json());

// 1. Root Route (Keeps Render Healthy)
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// 2. Webhook Verification (For Meta to test the URL)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Meta!');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed. Check VERIFY_TOKEN in Render.');
    res.sendStatus(403);
  }
});

// 3. Incoming Message Handler
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Log the raw data to the Render logs so we can see it!
  console.log('📩 RAW WEBHOOK RECEIVED:', JSON.stringify(body, null, 2));

  // Check if it's a WhatsApp message
  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;
    
    // Check if there is a message inside
    if (value.messages && value.messages[0]) {
      const message = value.messages[0];
      const userNumber = message.from; // This is the user's phone number
      const userText = message.text.body; // This is the text they sent

      console.log(`💬 Message from ${userNumber}: "${userText}"`);

      // 4. Send a reply back
      try {
        const replyData = {
          messaging_product: 'whatsapp',
          to: userNumber,
          type: 'text',
          text: { body: `Echo: You said "${userText}"` }
        };

        const response = await axios({
          method: 'POST',
          url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
          headers: { 
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          data: replyData
        });

        console.log('✅ Reply sent successfully! Meta Response:', response.data);
      } catch (error) {
        console.error('❌ Error sending reply:', error.response ? error.response.data : error.message);
      }
    } else {
      console.log('ℹ️ Webhook received (probably a system alert, not a chat message).');
    }
  }

  // Always respond with 200 to let Meta know we received it
  res.sendStatus(200);
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Maligai backend running on port ${port}`);
});
