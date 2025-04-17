const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 9700, // $97.00
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
