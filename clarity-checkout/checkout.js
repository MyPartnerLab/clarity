document.addEventListener('DOMContentLoaded', () => {
  // Initialize Stripe.js
  const stripe = Stripe('pk_live_51QxWEIKnSVoS1s5BDLXFPd5RF5JEG5pX5CODPpc9tRpcPoHMe9DQ5Nbr02OB0o9FIst1bzhjRWIVtnuvmq6JJ3N60082ykCDzA');
  const elements = stripe.elements();
  const card = elements.create('card');
  card.mount('#card-element');

  // DOM references
  const planEls       = document.querySelectorAll('.single-plan');
  const couponIn      = document.getElementById('coupon');
  const applyBtn      = document.getElementById('apply-coupon');
  const couponMsg     = document.getElementById('coupon-msg');
  const orderPrice    = document.getElementById('order-price');
  const discountRow   = document.getElementById('discount-row');
  const discountAmount= document.getElementById('discount-amount');
  const summaryNote   = document.getElementById('summary-note');
  const dueNote       = document.getElementById('due-note');
  const submitBtn     = document.getElementById('submit');
  const agreeBox      = document.getElementById('agree');
  const firstNameIn   = document.getElementById('firstName');
  const lastNameIn    = document.getElementById('lastName');
  const emailIn       = document.getElementById('email');

  // Pricing and coupons
  const BASE = { lifetime:97, monthly:17 };
  const couponMap = { LIVEFREE:100, BOGO50:50, SAVE20:20 };
  function pct(code) {
    return couponMap[ code.trim().toUpperCase() ] || 0;
  }
  function fmtDate(d){
    return d.toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' });
  }

  // State
  let currentPlan = 'lifetime';

  // Summary updater
  function updateSummary(plan){
    currentPlan = plan;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate()+14);

    const discount   = pct(couponIn.value);
    const base       = BASE[plan];
    const discounted = (base * (100 - discount)/100).toFixed(2);

    orderPrice.textContent = `$${base}${plan==='monthly'?'/mo':''}`;
    orderPrice.classList.toggle('cross', discount > 0);
    dueNote.textContent = `Your free trial ends on ${fmtDate(trialEnd)}.`;
    summaryNote.textContent = plan==='monthly'
      ? `After your trial ends on ${fmtDate(trialEnd)}, you will be charged $${discounted}/mo.`
      : `After your trial ends on ${fmtDate(trialEnd)}, you will be charged a one-time payment of $${discounted}.`;

    if (discount > 0) {
      discountRow.style.display = 'flex';
      discountRow.querySelector('span:first-child').textContent =
        `Discount code: ${couponIn.value.trim().toUpperCase()}.`;
      discountAmount.textContent =
        `$${(base - discounted).toFixed(2)} off`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  // Plan selector
  planEls.forEach(el => el.addEventListener('click', () => {
    planEls.forEach(x=>x.classList.remove('selected'));
    el.classList.add('selected');
    updateSummary(el.dataset.plan);
  }));

  // Coupon handler
  applyBtn.addEventListener('click', () => {
    const discount = pct(couponIn.value);
    if (discount > 0) {
      couponMsg.textContent = 'Your coupon has been applied to your order';
      couponMsg.className   = 'coupon-msg success';
    } else {
      couponMsg.textContent = 'The promo code you entered is not valid.';
      couponMsg.className   = 'coupon-msg error';
    }
    updateSummary(currentPlan);
  });

  // Initial render
  updateSummary(currentPlan);

  // Card input errors
  card.on('change', e => {
    document.getElementById('card-errors').textContent = e.error?.message || '';
  });

  // Submit handler
  submitBtn.addEventListener('click', async e => {
    console.log('🔔 submit clicked');
    e.preventDefault();
    document.getElementById('card-errors').textContent = '';

    if (!agreeBox.checked) {
      alert('Please agree to the terms & conditions.');
      return;
    }
    submitBtn.disabled = true;

    const data = {
      firstName: firstNameIn.value.trim(),
      lastName:  lastNameIn.value.trim(),
      email:     emailIn.value.trim(),
      plan:      currentPlan,
      coupon:    couponIn.value.trim().toUpperCase()
    };

    try {
      console.log('…about to fetch setup-intent');
      const siResp = await fetch('/api/create-setup-intent', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      const { clientSecret, customerId, error: siErr } = await siResp.json();
      if (siErr) throw new Error(siErr);

      console.log('…confirming card setup');
      const { error: confirmErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method:{ card, billing_details:{ name:`${data.firstName} ${data.lastName}`, email:data.email } }
      });
      if (confirmErr) throw new Error(confirmErr.message);

      console.log('…starting subscription');
      const subResp = await fetch('/api/start-subscription', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ customerId, plan:data.plan, coupon:data.coupon })
      });
      const { error: subErr } = await subResp.json();
      if (subErr) throw new Error(subErr);

      window.parent.postMessage({ type:'checkoutComplete', url:'https://mypartnerlab.co/checkout-thank-you' }, '*');
    } catch(err) {
      console.error('🔥 error in submit handler', err);
      document.getElementById('card-errors').textContent = err.message;
      submitBtn.disabled = false;
    }
  });

  // Auto-resize iframe height
  function postMyHeight(){
    window.parent.postMessage({ type:'checkoutHeight', height:document.documentElement.scrollHeight }, '*');
  }
  window.addEventListener('load',   postMyHeight);
  window.addEventListener('resize', postMyHeight);
});
