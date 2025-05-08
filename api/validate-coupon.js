// validate-coupon.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (evt) => {
  try {
    const { code } = JSON.parse(evt.body);

    // find the promotion code by "code" string
    const resp = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1
    });

    const promo = resp.data[0];
    if (!promo) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Invalid or expired code.' }) };
    }

    // send back the promotion_code ID, and discount info
    const { id, coupon } = promo;
    return {
      statusCode: 200,
      body: JSON.stringify({
        id,
        amount_off:   coupon.amount_off,
        percent_off:  coupon.percent_off,
        currency:     coupon.currency
      })
    };
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};
