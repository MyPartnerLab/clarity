// api/create-plan.js  (or netlify/functions/)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { firstName, lastName, email, paymentMethodId, plan } = JSON.parse(event.body);

    /* 1 — customer */
    let customer = (await stripe.customers.list({ email, limit: 1 })).data[0];
    if (!customer) customer = await stripe.customers.create({ email, name: `${firstName} ${lastName}` });

    /* 2 — attach card */
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    let clientSecret;

    /* —— Shared options —— */
    const baseOptions = {
      customer: customer.id,
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',           // <— important!
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],        // <— gives us the PI
      metadata: { plan }
    };

    /* —— Monthly —— */
    if (plan === 'monthly') {
      const sub = await stripe.subscriptions.create({
        ...baseOptions,
        items: [{ price: process.env.STRIPE_PRICE_MONTHLY }],
      });
      clientSecret = sub.latest_invoice.payment_intent.client_secret;
    }

    /* —— Lifetime —— */
    if (plan === 'lifetime') {
      const sub = await stripe.subscriptions.create({
        ...baseOptions,
        items: [{ price: process.env.STRIPE_PRICE_LIFETIME }],
        cancel_at_period_end: true,                     // auto-stop after first invoice
      });
      clientSecret = sub.latest_invoice.payment_intent.client_secret;
    }

    /* No PI? → send explicit error */
    if (!clientSecret) {
      throw new Error('Stripe did not return a PaymentIntent; check price IDs and customer data.');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret }),
    };
  } catch (err) {
    console.error('create-plan error:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
