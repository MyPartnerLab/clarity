// api/portal.js  (or netlify/functions/portal.js – same code)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 🔹 change this if you prefer to lock it to your exact domain
const ALLOW_ORIGIN = 'https://www.mypartnerlab.co';

exports.handler = async (event) => {
  // 🔸 Use the same header object everywhere
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  /* ── 1. Answer the browser’s pre-flight OPTIONS  ─────────────── */
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'OK',
    };
  }

  /* ── 2. Normal POST flow  ───────────────────────────────────── */
  try {
    const { customerId } = JSON.parse(event.body);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://community.mypartnerlab.co/',   // or wherever you want
    });

    return {
      statusCode: 200,
      headers: corsHeaders,        // ◄◄ include headers on the real response
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
