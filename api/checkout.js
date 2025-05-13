<script>
document.addEventListener('DOMContentLoaded', () => {
  const stripe      = Stripe('pk_live_51QxWEIKnSVoS1s5BDLXFPd5RF5JEG5pX5CODPpc9tRpcPoHMe9DQ5Nbr02OB0o9FIst1bzhjRWIVtnuvmq6JJ3N60082ykCDzA');
  const elements    = stripe.elements();
  const card        = elements.create('card');
  card.mount('#card-element');

  const planEls        = document.querySelectorAll('.single-plan');
  const couponIn       = document.getElementById('coupon');
  const applyBtn       = document.getElementById('apply-coupon');
  const couponMsg      = document.getElementById('coupon-msg');
  const orderPrice     = document.getElementById('order-price');
  const summaryNote    = document.getElementById('summary-note');
  const discountRow    = document.getElementById('discount-row');
  const discountAmount = document.getElementById('discount-amount');
  const submitBtn      = document.getElementById('submit');

  const BASE = { lifetime:97, monthly:17 };
  const couponMap = {
    LIVEFREE: 100,
    BOGO50:    50,
    SAVE20:    20
  };
  function pct(code) {
    return couponMap[ code.trim().toUpperCase() ] || 0;
  }
  function fmtDate(d){
    return d.toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' });
  }

  let currentPlan = 'lifetime';
  function updateSummary(plan){
    currentPlan = plan;
    const trialEnd  = new Date(); trialEnd.setDate(trialEnd.getDate() + 14);
    const discount   = pct(couponIn.value);
    const base       = BASE[plan];
    const discounted = (base * (100 - discount)/100).toFixed(2);

    orderPrice.textContent = `$${base}${plan==='monthly'?'/mo':''}`;
    orderPrice.classList.toggle('cross', discount > 0);
    summaryNote.textContent = plan==='monthly'
      ? `After your trial ends on ${fmtDate(trialEnd)}, you will be charged $${discounted} per month.`
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

  // Plan clicks
  planEls.forEach(el => el.addEventListener('click', () => {
    planEls.forEach(x=>x.classList.remove('selected'));
    el.classList.add('selected');
    updateSummary(el.dataset.plan);
  }));

  // Apply coupon
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

  // **Use button‐click instead of form submit**
  submitBtn.addEventListener('click', async e => {
    e.preventDefault();
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
      // 1) SetupIntent
      const siResp = await fetch('/.netlify/functions/create-setup-intent', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      const { clientSecret, customerId, error: siErr } = await siResp.json();
      if (siErr) throw new Error(siErr);

      // 2) Confirm Card
      const { error: confirmErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method:{
          card,
          billing_details:{ name:`${data.firstName} ${data.lastName}`, email:data.email }
        }
      });
      if (confirmErr) throw new Error(confirmErr.message);

      // 3) Subscription
      const subResp = await fetch('/.netlify/functions/start-subscription',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          customerId, plan:data.plan, coupon:data.coupon
        })
      });
      const { error: subErr } = await subResp.json();
      if (subErr) throw new Error(subErr);

      // Redirect parent
      window.parent.postMessage({
        type:'checkoutComplete',
        url: 'https://mypartnerlab.co/checkout-thank-you'
      }, '*');

    } catch(err) {
      document.getElementById('card-errors').textContent = err.message;
      submitBtn.disabled = false;
    }
  });

  // Let parent know height
  function postMyHeight(){
    window.parent.postMessage({
      type: 'checkoutHeight',
      height: document.documentElement.scrollHeight
    }, '*');
  }
  window.addEventListener('load',   postMyHeight);
  window.addEventListener('resize', postMyHeight);
});
</script>
