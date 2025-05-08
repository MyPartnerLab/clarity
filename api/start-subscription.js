// api/start-subscription.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    // accept an optional `coupon` field in the payload
    const { customerId, plan, coupon } = JSON.parse(event.body);

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY
      : process.env.STRIPE_PRICE_LIFETIME;

    /* STEP 1 — retrieve the latest payment method that was attached by the
       SetupIntent and make it the default for invoices */
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    });

    if (paymentMethods.data[0]) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethods.data[0].id,
        },
      });
    }

    /* STEP 2 — build subscription params */
    const subParams = {
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      cancel_at_period_end: plan === 'lifetime',   // lifetime = single charge
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      metadata: { plan },
    };

    // If we received a coupon/promotion code from the client, apply it:
    if (coupon) {
      // either on v2020-08-27+:
      subParams.discounts = [{ coupon }];
      // or if you’re using a promotion_code object:
      // subParams.discounts = [{ promotion_code: coupon }];
    }

    /* STEP 3 — create the subscription */
    const sub = await stripe.subscriptions.create(subParams);

    return {
      statusCode: 200,
      body: JSON.stringify({ subscriptionId: sub.id }),
    };
  } catch (err) {
    console.error('start-subscription error:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
