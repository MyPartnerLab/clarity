// api/create-payment-intent.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME, // $97 one‑time
  monthly:  process.env.STRIPE_PRICE_MONTHLY,  // $17/mo
  annual:   process.env.STRIPE_PRICE_ANNUAL,   // optional
};

const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async ({ body }) => {
  try {
    const { plan, email, firstName, lastName } = JSON.parse(body);

    const priceId = priceMap[plan];
    if (!priceId) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown plan: ${plan}` }) };
    }

    // 1) Find or create the Stripe Customer
    const [existing] = (await stripe.customers.list({ email, limit: 1 })).data;
    const customer = existing ||
      await stripe.customers.create({ email, name: `${firstName} ${lastName}` });

    // 2) Subscription flow
    if (subscriptionPlans.has(plan)) {
      // a) Create the subscription WITHOUT any expand
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        metadata: { plan },
      });

      // b) Now retrieve the invoice object and expand its payment_intent
      const invoice = await stripe.invoices.retrieve(
        subscription.latest_invoice,
        { expand: ['payment_intent'] }
      );

      // c) The client_secret you need:
      const clientSecret = invoice.payment_intent.client_secret;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          clientSecret,
        }),
      };
    }

    // 3) One‑time payment flow
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 9700, // $97.00 in cents
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: { plan },
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
    console.error('🔥 error in create-payment-intent:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
