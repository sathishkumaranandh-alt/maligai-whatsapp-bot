const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

// Read environment variables from Render
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.use(express.json());

// 1. Root Route (To keep Render from restarting)
app.get('/', (req, res) => {
  console.log('✅ Health check received on root route');
  res.status(200).send('Maligai WhatsApp Bot is running!');
});

// 2. Webhook Verification (Required by Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 Webhook verification attempt - Token provided:', token);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully by Meta!');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification FAILED. Check VERIFY_TOKEN env variable.');
    res.sendStatus(403);
  }
});

// 3. Message Receiver (This receives your WhatsApp messages)
app.post('/webhook', (req, res) => {
  const body = req.body;
  
  // --- THIS IS THE MOST IMPORTANT LINE ---
  console.log('📩 RAW JSON RECEIVED FROM META:');
  console.log(JSON.stringify(body, null, 2));
  // ---------------------------------------

  // Always send a 200 OK to let Meta know we got the message
  res.status(200).send('EVENT_RECEIVED');
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Maligai backend running on port ${port}`);
});

      
