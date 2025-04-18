// api/create-payment-intent.js

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { firstName, lastName, email } = JSON.parse(event.body);

    // 1) create a Stripe Customer (so the email + card are linked)
    const customer = await stripe.customers.create({
      name: `${firstName} ${lastName}`,
      email
    });

    // 2) create a PaymentIntent for $97.00 USD
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 9700,
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: { integration: 'single-product-checkout' }
    });

    // 3) return the secret to the front‑end
    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret
      })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: err.statusCode || 500,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
