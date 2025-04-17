// api/create-payment-intent.js   (Node 18 on Netlify)
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// 🔧 ENV‑controlled mapping
const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME, // one‑time $97
  monthly:  process.env.STRIPE_PRICE_MONTHLY,  // $17 / mo
  annual:   process.env.STRIPE_PRICE_ANNUAL,   // (optional) annual price
};

// Plans treated as recurring subscriptions
const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { plan = 'lifetime', email } = JSON.parse(event.body);

    const priceId = priceMap[plan];
    if (!priceId)
      return { statusCode: 400, body: `Unknown plan "${plan}".` };

    // --------------------------------------------------
    // 1.  Recurring subscription (monthly / annual)
    // --------------------------------------------------
    if (subscriptionPlans.has(plan)) {
      // a) Create (or find) a customer
      const customer = await stripe.customers.create({ email });

      // b) Draft subscription in incomplete state
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId, quantity: 1 }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: { plan },
      });

      const clientSecret =
        subscription.latest_invoice.payment_intent.client_secret;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          clientSecret,
          subscriptionId: subscription.id,
        }),
      };
    }

    // --------------------------------------------------
    // 2.  One‑time lifetime payment
    // --------------------------------------------------
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });

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
      body: JSON.stringify({ mode: 'one‑time', clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
