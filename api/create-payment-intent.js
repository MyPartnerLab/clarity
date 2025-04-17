const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// OPTIONAL: store these in Vercel env vars instead of hard‑coding
const PRICE_LIFETIME = 'price_lifetime_id_here';  // one‑time $97
const PRICE_MONTHLY  = 'price_monthly_id_here';   // $17 / mo

module.exports = async (req, res) => {
  const { plan, amount, email, firstName } = req.body ?? {};

  try {
    // 🔐 1. Create / fetch a customer
    const customer = await stripe.customers.create({
      email,
      name: firstName || undefined
    });

    // 🔐 2a. One‑time (lifetime) = PaymentIntent
    if (plan === 'lifetime') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,               // 9700
        currency: 'usd',
        customer,
        automatic_payment_methods: { enabled: true },
        metadata: { plan }
      });
      return res.status(200).json({ clientSecret: paymentIntent.client_secret });
    }

    // 🔐 2b. Monthly = Subscription
    //  • Create subscription → get latest‑invoice → grab its PaymentIntent client_secret.
    const subscription = await stripe.subscriptions.create({
      customer,
      items: [{ price: PRICE_MONTHLY }],
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card']
      },
      metadata: { plan }
    });

    const clientSecret =
      subscription.latest_invoice.payment_intent.client_secret;

    return res.status(200).json({ clientSecret });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};
