const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 9700,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
