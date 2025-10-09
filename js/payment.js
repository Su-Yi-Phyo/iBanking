// js/payment.js

// Get logged-in user info from sessionStorage
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) window.location.href = 'dashboard.html';

// Cancel button
function cancelForm() {
  window.location.href = 'dashboard.html';
}

// Step 1: Pre-fill user info
const fullNameField = document.getElementById('fullName');
const phoneField = document.getElementById('phoneNumber');
const emailField = document.getElementById('email');
const balanceField = document.getElementById('balance');

fullNameField.value = user.full_name;
phoneField.value = user.phone || '';
emailField.value = user.email || '';
balanceField.value = user.balance;

[fullNameField, phoneField, emailField, balanceField].forEach(f => {
  f.readOnly = true;
  f.classList.add('autofilled');
});

// Step 2: Fetch tuition when student ID is typed
document.getElementById('studentId').addEventListener('input', function () {
  const studentId = this.value.trim();
  if (!studentId) return;

  fetch(`/api/tuition/getTuition?student_id=${studentId}`)
    .then(res => res.json())
    .then(data => {
      const feeAmountField = document.getElementById('feeAmount');
      const paymentAmountField = document.getElementById('paymentAmount');

      if (data.status === 'success' && Array.isArray(data.tuition) && data.tuition.length) {
        const totalDue = data.tuition.reduce((sum, t) => sum + (Number(t.amount_due) - Number(t.amount_paid)), 0);

        feeAmountField.value = totalDue;
        feeAmountField.readOnly = true;
        feeAmountField.classList.add('autofilled');

        paymentAmountField.value = totalDue;
        paymentAmountField.readOnly = true;
        paymentAmountField.classList.add('autofilled');
      } else {
        feeAmountField.value = '';
        paymentAmountField.value = '';
      }
    })
    .catch(err => console.error(err));
});

// Step 3: Pre-fill payer balance
document.getElementById('balance').value = user.balance;

// Step 3 submission
document.getElementById('tuitionForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const studentId = document.getElementById('studentId').value.trim();
  const feeAmount = Number(document.getElementById('feeAmount').value);
  const paymentAmount = Number(document.getElementById('paymentAmount').value);
  const terms = document.getElementById('terms').checked;

  if (!studentId || !feeAmount || !paymentAmount) return alert('Please fill all fields.');
  if (!terms) return alert('You must agree to the terms.');
  if (paymentAmount !== feeAmount) return alert('Payment amount must equal tuition due.');
  if (paymentAmount > Number(user.balance)) return alert('Insufficient balance.');

  fetch('/api/payment/submitPayment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payer_id: user.user_id,
      student_id: studentId,
      amount: paymentAmount
    })
  })
    .then(res => res.json())
    .then(result => {
      if (result.status === 'pending' && result.transactionID) {
        // persist for OTP page 
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('transactionID', result.transactionID);

        // redirect WITH query 
        window.location.href = `otp.html?transactionID=${encodeURIComponent(result.transactionID)}`;
      } else if (result.status === 'success') {
        alert('Payment successful!');
        window.location.href = 'dashboard.html';
      } else {
        alert('Payment failed: ' + (result.message || 'Unknown error'));
      }
    })
    .catch(err => {
      console.error('submitPayment error:', err);
      alert('Server error submitting payment.');
    });
});


// Step navigation
function nextStep(step) {
  const currentStep = document.getElementById(`step-${step}`);
  currentStep.classList.remove("form-step-active");
  const next = step + 1;
  document.getElementById(`step-${next}`).classList.add("form-step-active");

  const currentIndicator = document.getElementById(`step-${step}-indicator`);
  const nextIndicator = document.getElementById(`step-${next}-indicator`);

  const stepFields = currentStep.querySelectorAll('input[required]');
  const allFilled = Array.from(stepFields).every(f => f.value.trim() !== '');
  if (allFilled) {
    currentIndicator.classList.remove("active");
    currentIndicator.classList.add("completed");
  } else {
    currentIndicator.classList.remove("completed");
    currentIndicator.classList.add("normal");
  }

  nextIndicator.classList.add("active");
}

function prevStep(step) {
  const currentStep = document.getElementById(`step-${step}`);
  currentStep.classList.remove("form-step-active");

  const prev = step - 1;
  const prevStepEl = document.getElementById(`step-${prev}`);
  prevStepEl.classList.add("form-step-active");

  const currentIndicator = document.getElementById(`step-${step}-indicator`);
  const prevIndicator = document.getElementById(`step-${prev}-indicator`);

  currentIndicator.classList.remove("active");
  prevIndicator.classList.add("active");

  const stepFields = prevStepEl.querySelectorAll('input[required]');
  const allFilled = Array.from(stepFields).every(f => f.value.trim() !== '');
  if (allFilled) {
    prevIndicator.classList.add("completed");
  } else {
    prevIndicator.classList.remove("completed");
    prevIndicator.classList.add("normal");
  }
}
