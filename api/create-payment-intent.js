// api/create-payment-intent.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME, // your $97 one‑time Price ID
  monthly:  process.env.STRIPE_PRICE_MONTHLY,  // your $17/mo Price ID
};

const subscriptionPlans = new Set(['monthly']);

exports.handler = async ({ body }) => {
  try {
    // 1) Parse the incoming JSON
    const {
      plan,
      paymentMethod: pmId,
      firstName,
      lastName,
      email
    } = JSON.parse(body);

    // 2) Lookup the Price ID
    const priceId = priceMap[plan];
    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Unknown plan: ${plan}` })
      };
    }

    // 3) Find or create the Stripe Customer
    const [existing] = (await stripe.customers.list({ email, limit: 1 })).data;
    const customer = existing ||
      await stripe.customers.create({
        email,
        name: `${firstName} ${lastName}`
      });

    // 4) Attach the PaymentMethod to the Customer
    await stripe.paymentMethods.attach(pmId, { customer: customer.id });
    // 5) Set as default for invoice payments
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: pmId }
    });

    // 6) Create subscription or one‑time payment
if (subscriptionPlans.has(plan)) {
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],

    // ← ensure Stripe will immediately create a PaymentIntent
    payment_behavior: 'default_incomplete',
    collection_method: 'charge_automatically',

    // ← expand the invoice object AND its payment_intent
    expand: [
      'latest_invoice',
      'latest_invoice.payment_intent'
    ]
  });

  console.log('Subscription object:', subscription);

  // safely grab the nested PaymentIntent
  const invoice       = subscription.latest_invoice;
  const paymentIntent = invoice.payment_intent;


      // 7) Handle SCA if required
      if (
        paymentIntent.status === 'requires_action' ||
        paymentIntent.status === 'requires_payment_method'
      ) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            requiresAction: true,
            clientSecret: paymentIntent.client_secret
          })
        };
      }

      // 8) Otherwise, subscription succeeded
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    } else {
      // One‑time payment flow
      const paymentIntent = await stripe.paymentIntents.create({
        amount: plan === 'lifetime' ? 9700 : 0,
        currency: 'usd',
        customer: customer.id,
        automatic_payment_methods: { enabled: true }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          clientSecret: paymentIntent.client_secret
        })
      };
    }
  } catch (err) {
    console.error('🔥 error in create-payment-intent:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
