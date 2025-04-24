// api/create-setup-intent.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { firstName, lastName, email } = JSON.parse(event.body);

    /* 1 — get or create the customer */
    let customer = (await stripe.customers.list({ email, limit: 1 })).data[0];
    if (!customer) {
      customer = await stripe.customers.create({ email, name: `${firstName} ${lastName}` });
    }

    /* 2 — create SetupIntent (card will be attached after confirmation) */
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret: setupIntent.client_secret,
        customerId:   customer.id,
      }),
    };
  } catch (err) {
    console.error('create-setup-intent error:', err);
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};
