// api/create-payment-intent.js
// Node 18 on Netlify

const Stripe = require('stripe');
// ← Make sure STRIPE_SECRET_KEY is your *secret* key (sk_test_…)
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME, // $97 one-time Price ID
  monthly:  process.env.STRIPE_PRICE_MONTHLY,  // $17/mo recurring Price ID
  annual:   process.env.STRIPE_PRICE_ANNUAL,   // optional
};

const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async ({ body }) => {
  try {
    const { plan, email, firstName, lastName } = JSON.parse(body);

    // 1) Lookup or create Stripe customer
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer =
      existing.data[0] ||
      (await stripe.customers.create({
        email,
        name: `${firstName} ${lastName}`,
      }));

    const priceId = priceMap[plan];
    if (!priceId) {
      throw new Error(`Unknown plan: ${plan}`);
    }

    // 2A) Subscription flow
    if (subscriptionPlans.has(plan)) {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],   // ← correct expand
        metadata: { plan },
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          clientSecret:
            subscription.latest_invoice.payment_intent.client_secret,
        }),
      };
    }

    // 2B) One‑time payment flow
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
    console.error(err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
