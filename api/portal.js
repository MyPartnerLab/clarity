// netlify/functions/portal.js
exports.handler = async (event) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const { customerId } = JSON.parse(event.body);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: 'https://community.mypartnerlab.co/'
  });                                          

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url })
  };
};
