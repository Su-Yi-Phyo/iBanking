// js/dashboard.js
const user = JSON.parse(sessionStorage.getItem('user'));
if (!user) window.location.href = 'login.html';

const tuitionStatus = document.getElementById("tuition-status");
const payButton = document.getElementById("pay-button");
const balanceDisplay = document.getElementById("balance-display");
const dueDisplay = document.getElementById("due-display");
const tbody = document.getElementById("transaction-table");
const searchInput = document.getElementById("search-input");   
const pageSizeSelect = document.getElementById("page-size");   

let fullHistory = [];  
let pageSize = pageSizeSelect ? Number(pageSizeSelect.value) : 5;

const fmtVND = n => `${Number(n).toLocaleString()} VND`;
const fmtDT  = iso => {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
};

balanceDisplay.textContent = fmtVND(user.balance);

//Tuition due 
fetch(`/api/tuition/getTuition?student_id=${encodeURIComponent(user.username)}`)
  .then(res => res.json())
  .then(data => {
    if (data.status !== 'success') return;

    const totalDue = data.tuition.reduce((sum, t) => sum + (Number(t.amount_due) - Number(t.amount_paid)), 0);
    dueDisplay.textContent = fmtVND(totalDue);

    if (totalDue <= 0) {
      tuitionStatus.textContent = `${user.full_name}, you already paid all tuition fees!`;
      payButton.textContent = "Paid";
      payButton.className = "btn btn-success";
      payButton.disabled = true;
    } else {
      tuitionStatus.textContent = `${user.full_name}, you still have tuition fees to pay.`;
      payButton.textContent = "Pay now";
      payButton.className = "btn btn-danger";
      payButton.disabled = false;
    }
  })
  .catch(err => console.error('Error fetching tuition:', err));

// -------- History
function loadHistory() {
  fetch(`/api/processing/history?user_id=${encodeURIComponent(user.user_id)}`)
    .then(res => res.json())
    .then(data => {
      if (data.status !== 'success') {
        console.warn('History fetch failed:', data.message);
        renderHistory([]);
        return;
      }
      fullHistory = Array.isArray(data.history) ? data.history : [];
      renderHistory();
    })
    .catch(err => {
      console.error('Error fetching history:', err);
      renderHistory([]);
    });
}

function applyFilters(rows) {
  let filtered = rows;

  // Text search by payment_id, student_id, student_name
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.trim().toLowerCase();
    filtered = filtered.filter(r =>
      String(r.payment_id).toLowerCase().includes(q) ||
      String(r.student_id).toLowerCase().includes(q) ||
      String(r.student_name || '').toLowerCase().includes(q)
    );
  }

  return filtered;
}

function renderHistory() {
  if (!tbody) return;

  // Clear
  tbody.innerHTML = '';

  // Filter
  const filtered = applyFilters(fullHistory);

  // Page-size (show first N)
  const N = pageSizeSelect ? Number(pageSizeSelect.value) : pageSize;
  const rows = filtered.slice(0, isNaN(N) ? 5 : N);

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.style.textAlign = 'center';
    td.textContent = 'No transactions yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');

    const no = document.createElement('td');
    no.textContent = String(idx + 1);
    tr.appendChild(no);

    const service = document.createElement('td');
    service.textContent = `Tuition Payment – ${r.student_name || r.student_id} (${r.student_id})`;
    tr.appendChild(service);

    const when = document.createElement('td');
    when.textContent = fmtDT(r.payment_date);
    tr.appendChild(when);

    const amt = document.createElement('td');
    amt.textContent = fmtVND(r.amount);
    tr.appendChild(amt);

    tbody.appendChild(tr);
  });
}

// Bind UI controls if present
if (searchInput) {
  searchInput.addEventListener('input', () => renderHistory());
}
if (pageSizeSelect) {
  pageSizeSelect.addEventListener('change', () => renderHistory());
}

// Button → go to payment form
payButton.addEventListener("click", () => {
  sessionStorage.setItem("user", JSON.stringify(user));
  window.location.href = "paymentForm.html";
});

// Initial load
loadHistory();
