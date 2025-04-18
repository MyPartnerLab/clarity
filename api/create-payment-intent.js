// api/create-payment-intent.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME, // $97 one‑time
  monthly:  process.env.STRIPE_PRICE_MONTHLY,  // $17/mo subscription
};

const subscriptionPlans = new Set(['monthly']);

exports.handler = async ({ body }) => {
  try {
    const {
      plan,
      paymentMethod: pmId,
      firstName,
      lastName,
      email
    } = JSON.parse(body);

    // 1) Validate plan
    const priceId = priceMap[plan];
    if (!priceId) {
      return { statusCode: 400,
        body: JSON.stringify({ error: `Unknown plan: ${plan}` })
      };
    }

    // 2) Lookup or create Customer
    const [existing] = (await stripe.customers.list({
      email, limit: 1
    })).data;
    const customer = existing || await stripe.customers.create({
      email,
      name: `${firstName} ${lastName}`
    });

    // 3) Attach PM to Customer
    await stripe.paymentMethods.attach(pmId, {
      customer: customer.id
    });
    // 4) Set default PM for invoices
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: pmId }
    });

    // 5) Create subscription (auto‐charged)
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });

    const invoice       = subscription.latest_invoice;
    const paymentIntent = invoice.payment_intent;

    // 6) If SCA is required, return clientSecret
    if (
      paymentIntent.status === 'requires_payment_method' ||
      paymentIntent.status === 'requires_action'
    ) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          requiresAction: true,
          clientSecret: paymentIntent.client_secret
        })
      };
    }

    // 7) Everything paid!
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
