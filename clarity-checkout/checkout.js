// checkout.js
console.log('✅ checkout.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  // — cache DOM nodes —
  const form           = document.getElementById('checkout-form');
  const orderPrice     = document.getElementById('order-price');
  const summaryNote    = document.getElementById('summary-note');
  const discountRow    = document.getElementById('discount-row');
  const discountLabel  = discountRow.querySelector('span:first-child');
  const discountAmount = document.getElementById('discount-amount');
  const planEls        = document.querySelectorAll('.single-plan');
  const couponIn       = document.getElementById('coupon');
  const applyBtn       = document.getElementById('apply-coupon');
  const couponMsg      = document.getElementById('coupon-msg');
  const submitBtn      = document.getElementById('submit');
  const agreeError     = document.getElementById('agree-error');
  const cardErrors     = document.getElementById('card-errors');

  console.log({ orderPrice, summaryNote, discountRow, discountLabel, discountAmount, submitBtn });

  // — config & helpers —
  const BASE      = { lifetime: 97, monthly: 17 };
  const couponMap = { LIVEFREE: 100, BOGO50: 50, SAVE20: 20 };
  const pct = code => couponMap[ code.trim().toUpperCase() ] || 0;
  const fmtDate = d => d.toLocaleDateString('en-US', {
    month:'short', day:'numeric', year:'numeric'
  });

  // — Stripe setup —
  const stripe  = Stripe('pk_live_51QxWEIKnSVoS1s5BDLXFPd5RF5JEG5pX5CODPpc9tRpcPoHMe9DQ5Nbr02OB0o9FIst1bzhjRWIVtnuvmq6JJ3N60082ykCDzA');
  const elements = stripe.elements();
  const card     = elements.create('card');
  card.mount('#card-element');
  card.on('change', e => {
    cardErrors.textContent = e.error?.message || '';
  });

  // — update the summary panel —
  let currentPlan = 'lifetime';
  function updateSummary(plan) {
    currentPlan = plan;
    console.log('🔄 updateSummary', plan);

    // compute discounts
    const code       = couponIn.value;
    const discount   = pct(code);
    const base       = BASE[plan];
    const discounted = (base * (100 - discount) / 100).toFixed(2);

    // price & trial note
    orderPrice.textContent = `$${base}${plan==='monthly'?'/mo':''}`;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    summaryNote.textContent = plan==='monthly'
      ? `After your trial ends on ${fmtDate(trialEnd)}, you will be charged $${discounted} per month.`
      : `After your trial ends on ${fmtDate(trialEnd)}, you will be charged a one-time payment of $${discounted}.`;

    // discount row
    if (discount > 0) {
      discountLabel.textContent  = `Coupon applied: ${code.trim().toUpperCase()}.`;
      discountAmount.textContent = `$${(base - discounted).toFixed(2)} off`;
      discountRow.style.display  = 'flex';
    } else {
      discountRow.style.display = 'none';
    }
  }

  // — plan selector UI —
  planEls.forEach(el => el.addEventListener('click', () => {
    planEls.forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    updateSummary(el.dataset.plan);
  }));

  // — coupon handler —
  applyBtn.addEventListener('click', () => {
    const code     = couponIn.value;
    const discount = pct(code);
    if (discount > 0) {
      couponMsg.textContent = '🎉 Your coupon has been applied!';
      couponMsg.className   = 'coupon-msg success';
    } else {
      couponMsg.textContent = 'This promo code is not valid.';
      couponMsg.className   = 'coupon-msg error';
    }
    updateSummary(currentPlan);
  });

  // first render
  updateSummary(currentPlan);

  // — form submission —  
  form.addEventListener('submit', async e => {
    e.preventDefault();
    agreeError.textContent = '';
    cardErrors.textContent = '';

    // inline terms error
    if (!form.agree.checked) {
      agreeError.textContent = 'Please agree to the terms & conditions before continuing.';
      return;
    }

    submitBtn.disabled = true;
    console.log('🔔 submit clicked');

    // gather data
    const data = {
      firstName: form.firstName.value.trim(),
      lastName:  form.lastName.value.trim(),
      email:     form.email.value.trim(),
      plan:      currentPlan,
      coupon:    couponIn.value.trim().toUpperCase()
    };

    try {
      // 1) Create SetupIntent
      const siResp = await fetch('/.netlify/functions/create-setup-intent', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      const { clientSecret, customerId, error: siErr } = await siResp.json();
      if (siErr) throw new Error(siErr);

      // 2) Confirm Card
      const { error: confirmErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name:  `${data.firstName} ${data.lastName}`,
            email: data.email
          }
        }
      });
      if (confirmErr) throw new Error(confirmErr.message);

      // 3) Start Subscription
      const subResp = await fetch('/.netlify/functions/start-subscription', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ customerId, plan: data.plan, coupon: data.coupon })
      });
      const { error: subErr } = await subResp.json();
      if (subErr) throw new Error(subErr);

      // on success, redirect parent
      window.parent.postMessage({
        type: 'checkoutComplete',
        url:  'https://mypartnerlab.co/checkout-thank-you'
      }, '*');

    } catch(err) {
      console.error(err);
      cardErrors.textContent = err.message;
      submitBtn.disabled = false;
    }
  });

  // — let parent frame know our height —
  function postMyHeight() {
    window.parent.postMessage({
      type:   'checkoutHeight',
      height: document.documentElement.scrollHeight
    }, '*');
  }
  window.addEventListener('load',   postMyHeight);
  window.addEventListener('resize', postMyHeight);
});
