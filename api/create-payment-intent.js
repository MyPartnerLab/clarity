// api/create-payment-intent.js
// This file tells Netlify how to create a Stripe PaymentIntent

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
console.log('KEY‑IN‑LAMBDA:', (process.env.STRIPE_SECRET_KEY || 'undefined').slice(0,12));

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Example: charge $1.00 (100 cents)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 100,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
