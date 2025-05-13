// checkout.js
console.log('✅ checkout.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  // — grab every DOM node up front —
  const orderPrice     = document.getElementById('order-price');
  const summaryNote    = document.getElementById('summary-note');
  const discountRow    = document.getElementById('discount-row');
  const discountLabel  = discountRow.querySelector('span');      // first <span>
  const discountAmount = document.getElementById('discount-amount');
  const planEls        = document.querySelectorAll('.single-plan');
  const couponIn       = document.getElementById('coupon');
  const applyBtn       = document.getElementById('apply-coupon');
  const couponMsg      = document.getElementById('coupon-msg');
  const submitBtn      = document.getElementById('submit');
  console.log({orderPrice, summaryNote, discountRow, discountLabel, discountAmount, submitBtn});

  // — basic config —
  const BASE = { lifetime: 97, monthly: 17 };
  const couponMap = { LIVEFREE: 100, BOGO50: 50, SAVE20: 20 };
  function pct(code = '') {
    return couponMap[ code.trim().toUpperCase() ] || 0;
  }
  function fmtDate(d) {
    return d.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
  }

  // — initialize Stripe Elements —
  const stripe = Stripe('pk_live_51QxWEIKnSVoS1s5BDLXFPd5RF5JEG5pX5CODPpc9tRpcPoHMe9DQ5Nbr02OB0o9FIst1bzhjRWIVtnuvmq6JJ3N60082ykCDzA'); 
  const elements = stripe.elements();
  const card = elements.create('card');
  card.mount('#card-element');

  // — summary logic —
  let currentPlan = 'lifetime';
  function updateSummary(plan) {
    currentPlan = plan;
    console.log('🔄 updateSummary', plan);

    const code     = couponIn.value.trim().toUpperCase();
    const discount = pct(code);
    const base     = BASE[plan];
    const discounted = (base * (100 - discount) / 100).toFixed(2);

    if (!orderPrice || !summaryNote || !discountLabel || !discountAmount) {
      console.error('Missing an element in updateSummary, aborting.');
      return;
    }

    // base price display
    orderPrice.textContent = `$${base}${plan==='monthly'?'/mo':''}`;

    // trial note
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    summaryNote.textContent = plan==='monthly'
      ? `After your trial ends on ${fmtDate(trialEnd)}, you will be charged $${discounted} per month.`
      : `After your trial ends on ${fmtDate(trialEnd)}, you will be charged a one-time payment of $${discounted}.`;

    // discount row
    if (discount > 0) {
      discountLabel.textContent  = `Coupon applied: ${code}.`;
      discountAmount.textContent = `$${(base - discounted).toFixed(2)} off`;
      discountRow.style.display  = 'flex';
    } else {
      discountRow.style.display = 'none';
    }
  }

  // — UI hooks —
  planEls.forEach(el => {
    el.addEventListener('click', () => {
      planEls.forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      updateSummary(el.dataset.plan);
    });
  });

  applyBtn.addEventListener('click', () => {
    const discount = pct(couponIn.value);
    if (discount > 0) {
      couponMsg.textContent = '🎉 Your coupon has been applied!';
      couponMsg.className   = 'coupon-msg success';
    } else {
      couponMsg.textContent = 'This promo code is not valid';
      couponMsg.className   = 'coupon-msg error';
    }
    updateSummary(currentPlan);
  });

  // initial render
  updateSummary(currentPlan);

  //accept terms
  const agreeError = document.getElementById('agree-error');

submitBtn.addEventListener('click', async e => {
  e.preventDefault();
  agreeError.textContent = '';              // clear any old message
  if (!document.getElementById('agree').checked) {
    agreeError.textContent = 'Please agree to our terms & conditions before clicking, "Secure My Spot".';
    submitBtn.disabled = false;
    return;
  }

  // stripe card errors
  card.on('change', e => {
    document.getElementById('card-errors').textContent = e.error?.message || '';
  });

  // — submit handler —
  submitBtn.addEventListener('click', async e => {
    e.preventDefault();
    console.log('🔔 submit clicked');
    document.getElementById('card-errors').textContent = '';

    if (!document.getElementById('agree').checked) {
      return alert('Please agree to the terms & conditions.');
    }
    submitBtn.disabled = true;

    const data = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName:  document.getElementById('lastName').value.trim(),
      email:     document.getElementById('email').value.trim(),
      plan:      currentPlan,
      coupon:    couponIn.value.trim().toUpperCase()
    };

    try {
      // 1) create SetupIntent
      const siResp = await fetch('/.netlify/functions/create-setup-intent', {
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data)
      });
      const { clientSecret, customerId, error: siErr } = await siResp.json();
      if (siErr) throw new Error(siErr);

      // 2) confirm card
      const { error: confirmErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method:{
          card,
          billing_details:{
            name: `${data.firstName} ${data.lastName}`,
            email: data.email
          }
        }
      });
      if (confirmErr) throw new Error(confirmErr.message);

      // 3) start subscription
      const subResp = await fetch('/.netlify/functions/start-subscription', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({customerId,plan:data.plan,coupon:data.coupon})
      });
      const { error: subErr } = await subResp.json();
      if (subErr) throw new Error(subErr);

      // on success, redirect parent
      window.parent.postMessage({
        type:'checkoutComplete',
        url:'https://mypartnerlab.co/checkout-thank-you'
      }, '*');

    } catch(err) {
      console.error(err);
      document.getElementById('card-errors').textContent = err.message;
      submitBtn.disabled = false;
    }
  });

  // tell parent frame our height
  function postMyHeight(){
    window.parent.postMessage({
      type:'checkoutHeight',
      height:document.documentElement.scrollHeight
    }, '*');
  }
  window.addEventListener('load',   postMyHeight);
  window.addEventListener('resize', postMyHeight);
});
