const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const { plan, firstName, lastName, email } = JSON.parse(event.body);
  // …lookup or create customer…
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 9700,
    currency: 'usd',
    customer: customer.id,
    automatic_payment_methods: { enabled: true }
  });
  return {
    statusCode: 200,
    body: JSON.stringify({ clientSecret: paymentIntent.client_secret })
  };
};
