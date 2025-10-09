function togglePassword() {
  const passwordInput = document.getElementById('password');
  const icon = document.querySelector('.toggle-password');
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  }
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const username = document.getElementById('username').value; 
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/login/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    const errorMsg = document.getElementById('errorMsg');
    if (result.status === 'success') {
      sessionStorage.setItem('user', JSON.stringify(result.user));
      window.location.href = 'dashboard.html';
    } else {
      errorMsg.textContent = 'Invalid username or password';
    }

  } catch (error) {
    console.error('Error:', error);
    alert('Server error, please try again later.');
  }
});

