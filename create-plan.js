// /.netlify/functions/create-plan.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { firstName, lastName, email, paymentMethodId, plan } = JSON.parse(event.body);

    /* 1 — get or create the customer */
    let customer = (await stripe.customers.list({ email, limit: 1 })).data[0];
    if (!customer) customer = await stripe.customers.create({ email, name: `${firstName} ${lastName}` });

    /* 2 — attach the card & make it default */
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    /* 3 — branch by plan */
    let clientSecret;

    /* ——— 3A  Monthly subscription ——— */
    if (plan === 'monthly') {
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.PRICE_MONTHLY }],
        trial_period_days: 14,
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { plan: 'monthly' },
      });

      const invoice = await stripe.invoices.retrieve(sub.latest_invoice);
      clientSecret = invoice.payment_intent.client_secret;
    }

    /* ——— 3B  Lifetime schedule ——— */
    if (plan === 'lifetime') {
      const now = Math.floor(Date.now() / 1000);
      const schedule = await stripe.subscriptionSchedules.create({
        customer: customer.id,
        start_date: 'now',
        end_behavior: 'cancel',
        phases: [
          /* Phase 1 – 14-day free trial, no items */
          {
            start_date: 'now',
            end_date: now + 14 * 24 * 60 * 60,
            items: [],                      // nothing billed in trial
          },
          /* Phase 2 – single $97 charge */
          {
            items: [{ price: process.env.PRICE_LIFETIME, quantity: 1 }],
            iterations: 1,                  // exactly one invoice
          },
        ],
        metadata: { plan: 'lifetime' },
      });

      /* grab the PaymentIntent from the very first (trial) invoice */
      const invoice = await stripe.invoices.retrieve(schedule.released_subscription.latest_invoice);
      clientSecret = invoice.payment_intent.client_secret;
    }

    return { statusCode: 200, body: JSON.stringify({ clientSecret }) };
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};
