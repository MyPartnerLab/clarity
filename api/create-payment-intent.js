// api/create-payment-intent.js (Node 18 / Netlify)

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Map your plans to the correct Price IDs
const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME,  // e.g. price_1AAA…
  monthly:  process.env.STRIPE_PRICE_MONTHLY,   // e.g. price_1BBB… (must be recurring monthly)
  annual:   process.env.STRIPE_PRICE_ANNUAL,    // e.g. price_1CCC… (if you add annual later)
};

// Plans that create subscriptions
const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let plan, email, firstName;
  try {
    ({ plan = 'lifetime', email, firstName } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const priceId = priceMap[plan];
  if (!priceId) {
    return { statusCode: 400, body: `Unknown plan "${plan}"` };
  }

  try {
    // ───────────────────────────────────
    // 1) SUBSCRIPTION: monthly or annual
    // ───────────────────────────────────
    if (subscriptionPlans.has(plan)) {
      // create a Customer so we can attach the payment method for off‑session renewals
      const customer = await stripe.customers.create({
        email,
        name: firstName
      });

      // create subscription in incomplete state with an initial invoice
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          clientSecret: subscription.latest_invoice.payment_intent.client_secret,
          subscriptionId: subscription.id
        })
      };
    }

    // ───────────────────────────────────
    // 2) ONE‑TIME PAYMENT: lifetime
    // ───────────────────────────────────

    // retrieve the Price so we get currency and unit_amount
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
