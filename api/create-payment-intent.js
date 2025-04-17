// api/create-payment-intent.js   (Node 18 on Netlify)

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// 🔧 ENV‑controlled mapping:
//   STRIPE_PRICE_LIFETIME = price_1XXX_lifetime
//   STRIPE_PRICE_MONTHLY  = price_1YYY_monthly
//   STRIPE_PRICE_ANNUAL   = price_1ZZZ_annual
const priceMap = {
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
  monthly:  process.env.STRIPE_PRICE_MONTHLY,
  annual:   process.env.STRIPE_PRICE_ANNUAL,
};

// Plans that should create a recurring Subscription instead of a one‑time charge
const subscriptionPlans = new Set(['monthly', 'annual']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { plan = 'lifetime', email } = JSON.parse(event.body);

    const priceId = priceMap[plan];
    if (!priceId)
      return { statusCode: 400, body: `Unknown plan "${plan}".` };

    // --------------------------------------------------
    // 1.  Subscriptions (monthly / annual)
    // --------------------------------------------------
    if (subscriptionPlans.has(plan)) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: 'https://mypartnerlab.co/checkout-thank-you?session_id={CHECKOUT_SESSION_ID}',
        cancel_url:  'https://mypartnerlab.co/checkout-cancelled',
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutUrl: session.url }),
      };
    }

    // --------------------------------------------------
    // 2.  One‑time PaymentIntent (lifetime)
    // --------------------------------------------------
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   price.unit_amount,
      currency: price.currency,
      automatic_payment_methods: { enabled: true },
      metadata: { plan },
      receipt_email: email,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
