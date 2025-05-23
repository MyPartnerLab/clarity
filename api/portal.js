// api/portal.js
exports.handler = async (event) => {

  /* ---------- 1. Handle the browser’s OPTIONS pre-flight ---------- */
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',          //  allow any site
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: 'OK',
    };
  }

  /* ---------- 2. Normal POST flow ---------- */
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const { customerId } = JSON.parse(event.body);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: 'https://community.mypartnerlab.co/', // or whatever URL you like
  });

  return {
    statusCode: 200,
    headers: {                                    //  ◄◄  CORS for the real response
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify({ url: session.url }),
  };
};
