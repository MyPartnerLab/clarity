// api/create-plan.js
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

    /* —— Monthly ($17/mo) —— */
    if (plan === 'monthly') {
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.STRIPE_PRICE_MONTHLY }],
        trial_period_days: 14,
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { plan },
      });
      const invoice = await stripe.invoices.retrieve(sub.latest_invoice, {
        expand: ['payment_intent'],
      });
      clientSecret = invoice.payment_intent.client_secret;
    }

    /* —— Lifetime ($97 once) —— */
    if (plan === 'lifetime') {
      /* Use a *recurring* $97 price but cancel after first cycle */
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.STRIPE_PRICE_LIFETIME }],
        trial_period_days: 14,
        cancel_at_period_end: true,                  // auto-stop after first invoice
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { plan },
      });
      const invoice = await stripe.invoices.retrieve(sub.latest_invoice, {
        expand: ['payment_intent'],
      });
      clientSecret = invoice.payment_intent.client_secret;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret }),
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
