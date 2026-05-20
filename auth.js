/**
 * RippleRead Auth — Global authentication module
 * Included on every page. Manages JWT tokens, API calls, and login/register forms.
 */
(function () {
  'use strict';

  /* ================================================================
     Global Auth Object (exposed as window.Auth)
     ================================================================ */
  var Auth = {
    token: localStorage.getItem("rr_token"),
    user: JSON.parse(localStorage.getItem("rr_user") || "null"),

    isLoggedIn: function () {
      return !!(this.token && this.user);
    },

    logout: function () {
      localStorage.removeItem("rr_token");
      localStorage.removeItem("rr_user");
      window.location.href = "/login.html";
    },

    fetch: async function (url, opts) {
      if (!opts) opts = {};
      if (!opts.headers) opts.headers = {};
      if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
        opts.body = JSON.stringify(opts.body);
        opts.headers["Content-Type"] = "application/json";
      }
      if (this.token) {
        opts.headers["Authorization"] = "Bearer " + this.token;
      }
      var response = await fetch(url, opts);
      if (response.status === 401) {
        this.logout();
        throw new Error("Session expired");
      }
      return response;
    },

    setSession: function (token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem("rr_token", token);
      localStorage.setItem("rr_user", JSON.stringify(user));
      this.updateUI();
    },

    updateUI: function () {
      var nameEl = document.getElementById('sidebar-user-name');
      var avatarEl = document.getElementById('sidebar-user-avatar');
      var greetingEl = document.getElementById('home-greeting-name');
      if (this.user) {
        var displayName = this.user.name || this.user.username || 'Reader';
        var initial = displayName.charAt(0).toUpperCase();
        if (nameEl) nameEl.textContent = displayName;
        if (avatarEl) avatarEl.textContent = initial;
        if (greetingEl) greetingEl.textContent = displayName;
      }
    }
  };

  window.Auth = Auth;

  /* ================================================================
     Auth Guard — redirect to login if not authenticated
     ================================================================ */
  var isLoginPage = window.location.pathname.indexOf('login.html') !== -1 ||
                    window.location.pathname === '/login' ||
                    window.location.pathname.endsWith('/login');

  if (!isLoginPage && !Auth.isLoggedIn()) {
    window.location.href = "/login.html";
  }

  /* If already logged in and on login page, redirect to home */
  if (isLoginPage && Auth.isLoggedIn()) {
    window.location.href = "/";
  }

  /* ================================================================
     Login Page Logic
     ================================================================ */
  if (!isLoginPage) return;

  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  var toast = document.querySelector('.auth-toast');

  if (!loginForm || !registerForm) return;

  /* ── Form switching ── */
  var switchButtons = document.querySelectorAll('[data-switch]');
  for (var i = 0; i < switchButtons.length; i++) {
    switchButtons[i].addEventListener('click', function () {
      switchForm(this.getAttribute('data-switch'));
    });
  }

  function switchForm(target) {
    var from = target === 'register' ? loginForm : registerForm;
    var to = target === 'register' ? registerForm : loginForm;

    if (!to.classList.contains('active')) {
      from.classList.remove('active');
      to.classList.add('active');
      hideToast();
      clearAllErrors();
    }
  }

  /* ── Password visibility toggle ── */
  var pswToggles = document.querySelectorAll('.auth-psw-toggle');
  for (var j = 0; j < pswToggles.length; j++) {
    pswToggles[j].addEventListener('click', function () {
      var input = document.getElementById(this.getAttribute('data-target'));
      if (!input) return;

      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      var eye = this.querySelector('.icon-eye');
      var eyeOff = this.querySelector('.icon-eye-off');
      if (eye) eye.style.display = isPassword ? 'none' : 'block';
      if (eyeOff) eyeOff.style.display = isPassword ? 'block' : 'none';
      this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  /* ── Toast helpers ── */
  function showToast(message, type) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'auth-toast auth-toast--' + type;
    toast.hidden = false;
    setTimeout(hideToast, 4000);
  }

  function hideToast() {
    if (!toast) return;
    toast.hidden = true;
    toast.textContent = '';
  }

  /* ── Error helpers ── */
  function showError(fieldId, message) {
    var el = document.getElementById(fieldId + 'Error');
    var input = document.getElementById(fieldId);
    if (el) { el.textContent = message; el.classList.add('visible'); }
    if (input) input.classList.add('input-error');
  }

  function clearError(fieldId) {
    var el = document.getElementById(fieldId + 'Error');
    var input = document.getElementById(fieldId);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
    if (input) input.classList.remove('input-error');
  }

  function clearAllErrors() {
    var errors = document.querySelectorAll('.auth-error');
    for (var k = 0; k < errors.length; k++) {
      errors[k].textContent = '';
      errors[k].classList.remove('visible');
    }
    var inputs = document.querySelectorAll('.auth-input');
    for (var m = 0; m < inputs.length; m++) {
      inputs[m].classList.remove('input-error');
    }
  }

  /* ── Validation ── */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateLoginForm() {
    var emailOk = true, passwordOk = true;
    var emailVal = (document.getElementById('loginEmail').value || '').trim();
    var passwordVal = document.getElementById('loginPassword').value;

    if (!emailVal) { showError('loginEmail', 'Email is required.'); emailOk = false; }
    else if (!isValidEmail(emailVal)) { showError('loginEmail', 'Please enter a valid email.'); emailOk = false; }
    else clearError('loginEmail');

    if (!passwordVal) { showError('loginPassword', 'Password is required.'); passwordOk = false; }
    else clearError('loginPassword');

    return emailOk && passwordOk;
  }

  function validateRegisterForm() {
    var usernameOk = true, emailOk = true, passwordOk = true;
    var usernameVal = (document.getElementById('regUsername').value || '').trim();
    var emailVal = (document.getElementById('regEmail').value || '').trim();
    var passwordVal = document.getElementById('regPassword').value;

    if (!usernameVal) { showError('regUsername', 'Username is required.'); usernameOk = false; }
    else if (usernameVal.length < 3) { showError('regUsername', 'Username must be at least 3 characters.'); usernameOk = false; }
    else clearError('regUsername');

    if (!emailVal) { showError('regEmail', 'Email is required.'); emailOk = false; }
    else if (!isValidEmail(emailVal)) { showError('regEmail', 'Please enter a valid email.'); emailOk = false; }
    else clearError('regEmail');

    if (!passwordVal) { showError('regPassword', 'Password is required.'); passwordOk = false; }
    else if (passwordVal.length < 8) { showError('regPassword', 'Password must be at least 8 characters.'); passwordOk = false; }
    else if (!/[a-zA-Z]/.test(passwordVal) || !/[0-9]/.test(passwordVal)) {
      showError('regPassword', 'Password must contain both letters and numbers.');
      passwordOk = false;
    }
    else clearError('regPassword');

    return usernameOk && emailOk && passwordOk;
  }

  /* ── Loading state ── */
  function setLoading(btn, loading) {
    if (loading) {
      btn.classList.add('auth-submit--loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('auth-submit--loading');
      btn.disabled = false;
    }
  }

  /* ── Login submit ── */
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideToast();

    if (!validateLoginForm()) return;

    var btn = loginForm.querySelector('.auth-submit');
    setLoading(btn, true);

    try {
      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;

      var response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      });

      var data = await response.json();

      if (!response.ok) {
        var msg = data.detail || 'Invalid email or password';
        showError('loginEmail', msg);
        showError('loginPassword', '');
        showToast(msg, 'error');
        setLoading(btn, false);
        return;
      }

      Auth.setSession(data.token, data.user);
      window.location.href = '/';
    } catch (err) {
      showToast(err.message || 'Network error. Please try again.', 'error');
      setLoading(btn, false);
    }
  });

  /* ── Register submit ── */
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideToast();

    if (!validateRegisterForm()) return;

    var btn = registerForm.querySelector('.auth-submit');
    setLoading(btn, true);

    try {
      var username = document.getElementById('regUsername').value.trim();
      var email = document.getElementById('regEmail').value.trim();
      var password = document.getElementById('regPassword').value;

      var response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, email: email, password: password })
      });

      var data = await response.json();

      if (!response.ok) {
        var msg = data.detail || 'Registration failed';
        if (msg.toLowerCase().indexOf('email') !== -1) showError('regEmail', msg);
        else if (msg.toLowerCase().indexOf('username') !== -1) showError('regUsername', msg);
        else showError('regEmail', msg);
        showToast(msg, 'error');
        setLoading(btn, false);
        return;
      }

      Auth.setSession(data.token, data.user);
      window.location.href = '/';
    } catch (err) {
      showToast(err.message || 'Network error. Please try again.', 'error');
      setLoading(btn, false);
    }
  });

  /* ── Live clear on input ── */
  var allInputs = document.querySelectorAll('.auth-input');
  for (var n = 0; n < allInputs.length; n++) {
    allInputs[n].addEventListener('input', function () {
      clearError(this.id);
    });
  }

})();
