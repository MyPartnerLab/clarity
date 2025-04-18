// api/create-payment-intent.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME, // $97 one‑time Price ID
  monthly:  process.env.STRIPE_PRICE_MONTHLY,  // $17/mo recurring Price ID
  annual:   process.env.STRIPE_PRICE_ANNUAL,   // optional
};

const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async ({ body }) => {
  try {
    // 1) Parse incoming payload
    const { plan, email, firstName, lastName } = JSON.parse(body);

    // 2) Lookup Price ID
    const priceId = priceMap[plan];
    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Unknown plan: ${plan}` }),
      };
    }

    // 3) Find or create Customer
    const [existing] = (await stripe.customers.list({ email, limit: 1 })).data;
    const customer = existing ||
      await stripe.customers.create({ email, name: `${firstName} ${lastName}` });

    // 4) Subscription flow
if (subscriptionPlans.has(plan)) {
  // 1) Create the subscription WITHOUT any expand
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    metadata: { plan },
  });

  console.log('🔔 subscription created:', subscription.id,
    'latest_invoice:', subscription.latest_invoice);

  // 2) Retrieve the invoice by ID, expanding its payment_intent
  const invoice = await stripe.invoices.retrieve(
    subscription.latest_invoice,
    { expand: ['payment_intent'] }
  );
  console.log('🔔 invoice retrieved:', invoice.id,
    'payment_intent:', invoice.payment_intent?.id);

  if (!invoice.payment_intent) {
    throw new Error(
      'No payment_intent on Invoice—check that your price is set to charge automatically.'
    );
  }

  // 3) Send the client_secret back
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'subscription',
      clientSecret: invoice.payment_intent.client_secret,
    }),
  };
}

      // 4b) Retrieve the invoice and expand its payment_intent
      const invoice = await stripe.invoices.retrieve(
        subscription.latest_invoice,
        { expand: ['payment_intent'] }
      );

      // 4c) Grab the client_secret from the retrieved invoice
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

    // 5) One‑time payment flow
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
