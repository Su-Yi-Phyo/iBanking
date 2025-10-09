// js/otp.js
document.addEventListener("DOMContentLoaded", () => {
  const otpInputs = document.querySelectorAll(".otp");
  const verifyBtn = document.querySelector(".verify-btn");
  const resendLink = document.getElementById("resend-link");

  if (otpInputs[0]) otpInputs[0].focus();

  otpInputs.forEach((input, idx) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      if (input.value.length === 1 && idx < otpInputs.length - 1) {
        otpInputs[idx + 1].focus();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        otpInputs[idx - 1].focus();
      }
    });
  });

  const urlParams = new URLSearchParams(window.location.search);
  let transactionID = urlParams.get("transactionID") || localStorage.getItem("transactionID");

  console.log("Loaded transactionID:", transactionID);
  console.log("From URL:", urlParams.get("transactionID"));
  console.log("From localStorage:", localStorage.getItem("transactionID"));

  if (!transactionID) {
    alert("Missing transaction ID. Please start payment again.");
    return;
  }
  localStorage.setItem("transactionID", transactionID);

  const userEmail = localStorage.getItem("userEmail");
  if (!userEmail) {
    console.warn("No userEmail found in localStorage.");
    alert("Missing user email. Please log in again.");
  }

  // Verify OTP -> Process -> Notify -> Redirect
  verifyBtn.addEventListener("click", () => {
    const otpCode = Array.from(otpInputs).map(i => i.value).join("");
    if (otpCode.length < 4) {
      alert("Please enter the full 4-digit OTP.");
      return;
    }

    fetch("/api/validation/verifyOTP", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionID, enteredOTP: otpCode })
    })
      .then(r => r.json())
      .then(async data => {
        if (data.status !== "success") {
          alert(data.message || "Verification failed.");
          return;
        }

        // 1) Process the transaction (deduct balance, update tuition)
        const procRes = await fetch("/api/processing/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionID })
        });
        const proc = await procRes.json();

        if (proc.status === "success") {
          // Update local session balance for dashboard
          const user = JSON.parse(sessionStorage.getItem('user') || '{}');
          if (user && proc.transaction && typeof proc.transaction.new_balance === 'number') {
            user.balance = proc.transaction.new_balance;
            sessionStorage.setItem('user', JSON.stringify(user));
          }

          // 2) Send confirmation email (non-blocking for UX)
          try {
            await fetch("/api/notification/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionID })
            });
          } catch (e) {
            console.warn("Notification email failed (continuing):", e);
          }

          // 3) Redirect to dashboard
          localStorage.removeItem("transactionID");
          window.location.href = "dashboard.html";
        } else {
          alert("Processing failed: " + (proc.message || 'Unknown error'));
        }
      })
      .catch(err => {
        console.error("Verify/Process error:", err);
        alert("Server error verifying or processing payment.");
      });
  });

  // Resend section unchanged...
  let resendCountdown = 60;
  let countdownInterval;

  function startResendCountdown() {
    resendLink.style.pointerEvents = 'none';
    resendLink.style.color = 'gray';
    resendLink.textContent = `Resend Again! (${resendCountdown}s)`;

    countdownInterval = setInterval(() => {
      resendCountdown--;
      resendLink.textContent = `Resend Again! (${resendCountdown}s)`;

      if (resendCountdown <= 0) {
        clearInterval(countdownInterval);
        resendLink.textContent = 'Resend Again!';
        resendLink.style.pointerEvents = 'auto';
        resendLink.style.color = '#007bff';
        resendCountdown = 60;
      }
    }, 1000);
  }

  startResendCountdown();

  resendLink.addEventListener("click", (e) => {
    e.preventDefault();

    if (!userEmail || !transactionID) {
      alert("Cannot resend OTP: missing email or transaction ID.");
      return;
    }

    fetch("/api/validation/resendOTP", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail, transactionID })
    })
      .then(r => r.json())
      .then(data => {
        if (data.status === "success") {
          alert(data.message + "\nPlease check your email again.");
          clearInterval(countdownInterval);
          resendCountdown = 60;
          startResendCountdown();
        } else {
          alert((data.message || "Failed to resend OTP."));
        }
      })
      .catch(err => {
        console.error("Resend OTP error:", err);
        alert("Server error resending OTP.");
      });
  });
});
