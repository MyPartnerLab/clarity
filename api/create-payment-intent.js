// functions/create-subscription.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
  monthly:  process.env.STRIPE_PRICE_MONTHLY,
};

exports.handler = async (event) => {
  try {
    const { plan, firstName, lastName, email } = JSON.parse(event.body);
    const priceId = priceMap[plan];
    if (!priceId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Unknown plan' }) };
    }

    // 1) Find or create the Customer
    const [existing] = (await stripe.customers.list({ email, limit: 1 })).data;
    const customer = existing ||
      await stripe.customers.create({ email, name: `${firstName} ${lastName}` });

    // 2) Create the subscription in “incomplete” status,
    //    saving the default PM on success, and expand the invoice’s confirmation_secret
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.confirmation_secret']
    });

    // 3) Return only the client secret
    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret: subscription.latest_invoice.confirmation_secret.client_secret
      })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
