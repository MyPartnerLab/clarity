// api/create-payment-intent.js   (Node 18 on Netlify)

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// map your ENV vars to plan names
const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
  monthly:  process.env.STRIPE_PRICE_MONTHLY,
  annual:   process.env.STRIPE_PRICE_ANNUAL,
};

// which ones should be a Subscription
const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan = 'lifetime', email } = JSON.parse(event.body);
    const priceId = priceMap[plan];

    if (!priceId) {
      return { statusCode: 400, body: `Unknown plan "${plan}".` };
    }

    // ─── 1) SUBSCRIPTION FLOW ───────────────────────────────
    if (subscriptionPlans.has(plan)) {
      // create or reuse a Customer
      const customer = await stripe.customers.create({ email });

      // create the subscription in 'incomplete' state, no expand
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId, quantity: 1 }],
        payment_behavior: 'default_incomplete',
      });

      // then fetch the first invoice, expanding its payment_intent
      const invoice = await stripe.invoices.retrieve(
        subscription.latest_invoice,
        { expand: ['payment_intent'] }
      );

      const paymentIntent = invoice.payment_intent;
      const clientSecret  = paymentIntent.client_secret;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          clientSecret,
        }),
      };
    }

    // ─── 2) ONE‑TIME PAYMENT FLOW ────────────────────────────
    const price = await stripe.prices.retrieve(priceId);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: price.currency,
      automatic_payment_methods: { enabled: true },
      metadata: { plan },
      receipt_email: email,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'payment',
        clientSecret: paymentIntent.client_secret,
      }),
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
