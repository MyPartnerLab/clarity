const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME, // your price_1… for $97 one‑time
  monthly:  process.env.STRIPE_PRICE_MONTHLY,  // your price_1… for $17/mo
  annual:   process.env.STRIPE_PRICE_ANNUAL,   // optional
};

// which plans we treat as subscriptions
const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async ({ body }) => {
  try {
    // 1) Parse the incoming form payload
    const { plan, email, firstName, lastName } = JSON.parse(body);

    // 2) Make sure we have a Price ID for that plan
    const priceId = priceMap[plan];
    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Unknown plan: ${plan}` }),
      };
    }

    // 3) Find or create a Stripe customer
    const [existing] = (await stripe.customers.list({ email, limit: 1 })).data;
    const customer =
      existing ||
      (await stripe.customers.create({
        email,
        name: `${firstName} ${lastName}`,
      }));

    // 4) If it's a subscription plan, create a subscription…
    if (subscriptionPlans.has(plan)) {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        // this is the critical bit:
        expand: ['latest_invoice.payment_intent'],
        metadata: { plan },
      });

      console.log(
        '🗒️ subscription object:',
        JSON.stringify(subscription, null, 2)
      );

      const clientSecret =
        subscription.latest_invoice.payment_intent.client_secret;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          clientSecret,
        }),
      };
    }

    // 5) Otherwise, one‑time payment with a PaymentIntent:
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 9700, // 97.00 USD
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: { plan },
    });

    console.log(
      '🗒️ paymentIntent object:',
      JSON.stringify(paymentIntent, null, 2)
    );

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
