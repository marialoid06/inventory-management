const API_URL = '/api'; 

// ========================
// 1. LOGIN LOGIC
// ========================
async function login(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            
            if (data.role === 'admin') window.location.href = 'admin-dashboard.html';
            else window.location.href = 'customer-shop.html';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Server error. Please try again later.");
    }
}

// ========================
// 2. REGISTER LOGIC
// ========================
async function register(event) {
    event.preventDefault();
    
    // Ensure these IDs exist in your register.html
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value; 
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password })
        });

        const data = await res.json();
        if (res.ok) {
            alert('Registration Successful! Please login.');
            window.location.href = 'login.html'; 
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error("Register Error:", error);
        alert("Server error.");
    }
}

// ========================
// 3. FORGOT PASSWORD LOGIC
// ========================
async function forgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const messageDiv = document.getElementById('message');

    try {
        const res = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();
        
        if (res.ok) {
            messageDiv.style.color = 'green';
            messageDiv.innerText = "If an account exists, a reset link has been sent.";
        } else {
            messageDiv.style.color = 'red';
            messageDiv.innerText = data.message;
        }
    } catch (error) {
        console.error("Forgot Pass Error:", error);
        alert("Server error.");
    }
}

// ========================
// 4. RESET PASSWORD LOGIC
// ========================
async function resetPassword(event) {
    event.preventDefault();
    
    // Parses the token from the URL (e.g. ?token=12345)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    // IMPORTANT: Matches the ID in reset-password.html
    const newPassword = document.getElementById('new-password').value;

    if (!token) {
        alert("Invalid or missing token.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            alert("Password updated successfully! Redirecting to login...");
            window.location.href = 'login.html';
        } else {
            alert(data.message || "Failed to reset password.");
        }
    } catch (error) {
        console.error("Reset Error:", error);
        alert("Server error.");
    }
}

// ========================
// 5. EVENT LISTENERS
// ========================
// The 'if' checks prevent errors when pages don't have these forms

const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.addEventListener('submit', login);

const registerForm = document.getElementById('register-form');
if (registerForm) registerForm.addEventListener('submit', register);

const forgotForm = document.getElementById('forgot-form');
if (forgotForm) forgotForm.addEventListener('submit', forgotPassword);

const resetForm = document.getElementById('reset-form');
if (resetForm) resetForm.addEventListener('submit', resetPassword);

// ========================
// 6. TOGGLE PASSWORD VISIBILITY (EYE ICON)
// ========================
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        // Find the input field within the same container
        const input = this.parentElement.querySelector('input');
        const iconShow = this.querySelector('.icon-show');
        const iconHide = this.querySelector('.icon-hide');
        
        if (input.type === 'password') {
            input.type = 'text';
            iconShow.style.display = 'none';
            iconHide.style.display = 'block';
        } else {
            input.type = 'password';
            iconShow.style.display = 'block';
            iconHide.style.display = 'none';
        }
    });
});