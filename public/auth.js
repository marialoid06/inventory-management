// public/auth.js
document.addEventListener('DOMContentLoaded', () => {

    const messageEl = document.getElementById('message');

    // Helper function to show messages
    const showMessage = (message, isSuccess) => {
        if (!messageEl) return;
        messageEl.textContent = message;
        messageEl.className = isSuccess ? 'message-success' : 'message-error';
    };

    // --- Show/Hide Password Toggle ---
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', () => {
            const passwordField = button.previousElementSibling;
            const showIcon = button.querySelector('.icon-show');
            const hideIcon = button.querySelector('.icon-hide');

            if (passwordField.getAttribute('type') === 'password') {
                passwordField.setAttribute('type', 'text');
                showIcon.style.display = 'none';
                hideIcon.style.display = 'inline';
            } else {
                passwordField.setAttribute('type', 'password');
                showIcon.style.display = 'inline';
                hideIcon.style.display = 'none';
            }
        });
    });

    // --- API Helper ---
    const apiCall = async (endpoint, body) => {
        try {
            const response = await fetch(`/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            return { ok: response.ok, data };
        } catch (error) {
            return { ok: false, data: { message: 'Network error. Please try again.' } };
        }
    };

    // --- 1. Handle Registration ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const { ok, data } = await apiCall('register', { username, email, password });

            if (ok) {
                showMessage('Registration successful! Redirecting to login...', true);
                setTimeout(() => window.location.href = '/login.html', 2000);
            } else {
                showMessage(data.message, false);
            }
        });
    }

    // --- 2. Handle Login ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const { ok, data } = await apiCall('login', { email, password });

            if (ok) {
                localStorage.setItem('token', data.token);
                if (data.role === 'admin') {
                    window.location.href = '/admin-dashboard.html'; 
                } else {
                    window.location.href = '/customer-shop.html';
                }
            } else {
                showMessage(data.message, false);
            }
        });
    }

    // --- 3. Handle Forgot Password ---
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const { ok, data } = await apiCall('forgot-password', { email });
            
            if (ok) {
                showMessage(data.message, true);
            } else {
                showMessage(data.message, false);
            }
        });
    }

    // --- 4. Handle Reset Password ---
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) {
            showMessage('Invalid or missing reset token.', false);
            return;
        }

        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            
            const { ok, data } = await apiCall('reset-password', { token, password });

            if (ok) {
                showMessage('Password reset successfully! Redirecting to login...', true);
                setTimeout(() => window.location.href = '/login.html', 2000);
            } else {
                showMessage(data.message, false);
            }
        });
    }
});