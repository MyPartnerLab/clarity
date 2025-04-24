// api/start-subscription.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { customerId, plan } = JSON.parse(event.body);

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY
      : process.env.STRIPE_PRICE_LIFETIME;

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      cancel_at_period_end: plan === 'lifetime',   // ← monthly stays false
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: { plan },
    });

    return { statusCode: 200, body: JSON.stringify({ subscriptionId: sub.id }) };
  } catch (err) {
    console.error('start-subscription error:', err);
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};
