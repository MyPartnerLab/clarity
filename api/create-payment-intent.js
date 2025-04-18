// api/create-payment-intent.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
  monthly:  process.env.STRIPE_PRICE_MONTHLY
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan = 'lifetime', email, firstName } = JSON.parse(event.body);
    const priceId = priceMap[plan];
    
    // ← debug log!
    console.log(`⌛ create-payment-intent for plan=${plan}, priceId=${priceId}`);
        if (!priceId) {
      return { statusCode: 400, body: `Unknown plan "${plan}".` };
    }

    if (!priceId) {
      return {
        statusCode: 400,
        body: `Unknown plan "${plan}"`
      };
    }

    // ---- Subscription flow (monthly) ----
    if (plan === 'monthly') {
      const customer = await stripe.customers.create({
        email,
        name: firstName
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId, quantity: 1 }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });

      const pi = subscription.latest_invoice.payment_intent;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          clientSecret: pi.client_secret
        })
      };
    }

    // ---- One‑time payment flow (lifetime) ----
    const price = await stripe.prices.retrieve(priceId);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: price.currency,
      automatic_payment_methods: { enabled: true },
      metadata: { plan },
      receipt_email: email
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'payment',
        clientSecret: paymentIntent.client_secret
      })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
