/**
 * RippleRead Global Sidebar — single source of truth
 *
 * Every page includes:
 *   <div id="globalSidebar" data-page="home|vocabulary|statistics|reader"></div>
 *   <script src="sidebar.js"></script>
 *
 * The data-page attribute controls which nav item is highlighted.
 * On reader pages the existing sidebar is augmented instead of replaced.
 */

(function() {
  'use strict';

  var SIDEBAR_HTML_URL = 'sidebar.html?v=5';
  var activePage = null;

  /* ------------------------------------------------------------------
     Toast notification (self-contained, works on every page)
     ------------------------------------------------------------------ */
  function rippleToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    var icon = type === 'success'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    toast.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">' + icon + '<span>' + message + '</span></div>';
    container.appendChild(toast);
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }

  /* ------------------------------------------------------------------
     Settings Modal HTML (inlined so no secondary fetch needed)
     ------------------------------------------------------------------ */
  var SETTINGS_MODAL_HTML = [
    '<div id="settingsOverlay">',
    '  <div id="settingsBackdrop"></div>',
    '  <div id="settingsModal">',
    '    <div class="settings-modal-header">',
    '      <span class="settings-modal-title">Settings</span>',
    '      <button class="settings-modal-close" id="settingsModalClose" aria-label="Close settings">',
    '        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    '      </button>',
    '    </div>',
    '    <div class="settings-modal-body">',
    '      <div class="settings-sidebar">',
    '        <button class="settings-tab-btn s--active" data-tab="appearance">',
    '          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>',
    '          Appearance',
    '        </button>',
    '        <button class="settings-tab-btn" data-tab="mentor">',
    '          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>',
    '          AI Mentor',
    '        </button>',
    '        <button class="settings-tab-btn" data-tab="advanced">',
    '          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>',
    '          Advanced',
    '        </button>',
    '      </div>',
    '      <div class="settings-content">',
    '        <div class="settings-tab-panel s--active" data-panel="appearance">',
    '          <p class="settings-section-title">Reading Display</p>',
    '          <div class="settings-control-group">',
    '            <div class="settings-label-row"><span class="settings-label">Font Size</span><span class="settings-value" id="fontSizeValue">18px</span></div>',
    '            <input type="range" class="settings-slider" id="fontSizeSlider" min="12" max="28" value="18" step="1">',
    '            <div class="settings-slider-ticks"><span class="settings-tick">12</span><span class="settings-tick">20</span><span class="settings-tick">28</span></div>',
    '          </div>',
    '          <div class="settings-control-group">',
    '            <div class="settings-label-row"><span class="settings-label">Line Height</span><span class="settings-value" id="lineHeightValue">1.6</span></div>',
    '            <input type="range" class="settings-slider" id="lineHeightSlider" min="1.2" max="2.5" value="1.6" step="0.1">',
    '            <div class="settings-slider-ticks"><span class="settings-tick">1.2</span><span class="settings-tick">1.8</span><span class="settings-tick">2.5</span></div>',
    '            <p class="settings-desc">Adjust the spacing between lines for comfortable reading.</p>',
    '          </div>',
    '          <div class="settings-control-group">',
    '            <div class="settings-label-row">',
    '              <span class="settings-label">Dark Mode</span>',
    '              <label class="theme-toggle">',
    '                <input type="checkbox" id="darkModeToggle">',
    '                <span class="theme-toggle-slider"></span>',
    '              </label>',
    '            </div>',
    '            <p class="settings-desc">Switch between light and dark appearance.</p>',
    '          </div>',
    '        </div>',
    '        <div class="settings-tab-panel" data-panel="mentor">',
    '          <p class="settings-section-title">AI Mentor Configuration</p>',
    '          <div class="settings-control-group">',
    '            <div class="settings-label-row"><span class="settings-label">Target Lexile Level</span><span class="settings-value" id="lexileValue">800L</span></div>',
    '            <input type="range" class="settings-slider" id="lexileSlider" min="200" max="1600" value="800" step="100">',
    '            <div class="settings-slider-ticks"><span class="settings-tick">200L</span><span class="settings-tick">900L</span><span class="settings-tick">1600L</span></div>',
    '            <p class="settings-desc">Content will be adapted to match your reading proficiency level.</p>',
    '          </div>',
    '          <div class="settings-control-group">',
    '            <span class="settings-label" style="display:block;margin-bottom:10px;">Native Language</span>',
    '            <select class="settings-select" id="nativeLanguageSelect">',
    '              <option value="Chinese">Chinese (中文)</option><option value="Japanese">Japanese (日本語)</option>',
    '              <option value="Korean">Korean (한국어)</option><option value="Spanish">Spanish (Español)</option>',
    '              <option value="French">French (Français)</option><option value="German">German (Deutsch)</option>',
    '              <option value="Portuguese">Portuguese (Português)</option><option value="Arabic">Arabic (العربية)</option>',
    '              <option value="Russian">Russian (Русский)</option><option value="Vietnamese">Vietnamese (Tiếng Việt)</option>',
    '            </select>',
    '            <p class="settings-desc">Used for word translations and contextual explanations.</p>',
    '          </div>',
    '        </div>',
    '        <div class="settings-tab-panel" data-panel="advanced">',
    '          <p class="settings-section-title">Advanced</p>',
    '          <div class="settings-empty-state">',
    '            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>',
    '            <p>More advanced settings will be available in a future update.<br>Stay tuned!</p>',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '    <div class="settings-modal-footer">',
    '      <button class="settings-btn-cancel" id="settingsBtnCancel">Cancel</button>',
    '      <button class="settings-btn-save" id="settingsBtnSave">Save &amp; Close</button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  /* ------------------------------------------------------------------
     Profile Modal HTML (inlined so no secondary fetch needed)
     ------------------------------------------------------------------ */
  var PROFILE_MODAL_HTML = [
    '<div id="profileOverlay">',
    '  <div id="profileBackdrop"></div>',
    '  <div id="profileModal">',
    '    <div class="profile-modal-header">',
    '      <span class="profile-modal-title">Edit Profile</span>',
    '      <button class="profile-modal-close" id="profileModalClose" aria-label="Close profile editor">',
    '        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    '      </button>',
    '    </div>',
    '    <div class="profile-modal-body">',
    '      <div class="profile-avatar-preview">',
    '        <div class="profile-avatar-circle">',
    '          <span id="profileAvatarLetter">E</span>',
    '        </div>',
    '      </div>',
    '      <div class="profile-field">',
    '        <label class="profile-label" for="editUserName">Display Name</label>',
    '        <input type="text" id="editUserName" class="profile-input" placeholder="Enter your name" maxlength="30" autocomplete="off">',
    '        <p class="profile-hint">This name will appear in your greetings and AI companion conversations.</p>',
    '      </div>',
    '    </div>',
    '    <div class="profile-modal-footer">',
    '      <button class="profile-btn-cancel" id="profileBtnCancel">Cancel</button>',
    '      <button class="profile-btn-save" id="profileBtnSave">Save</button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  /* ------------------------------------------------------------------
     Page detection
     ------------------------------------------------------------------ */
  function detectPage() {
    var container = document.getElementById('globalSidebar');
    if (container && container.getAttribute('data-page')) {
      return container.getAttribute('data-page');
    }
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf('reader') !== -1) return 'reader';
    if (path.indexOf('explore') !== -1) return 'explore';
    if (path.indexOf('vocabulary') !== -1) return 'notebook';
    if (path.indexOf('statistics') !== -1) return 'statistics';
    if (path.indexOf('book_library') !== -1) return 'books';
    if (path.indexOf('library') !== -1) return 'library';
    if (path.indexOf('news') !== -1) return 'news';
    return 'home';
  }

  /* ------------------------------------------------------------------
     Inject Settings Modal into <body> once
     ------------------------------------------------------------------ */
  function injectSettingsModal() {
    if (document.getElementById('settingsOverlay')) return;
    var div = document.createElement('div');
    div.innerHTML = SETTINGS_MODAL_HTML;
    while (div.firstChild) {
      document.body.appendChild(div.firstChild);
    }
  }

  /* ------------------------------------------------------------------
     Inject Profile Modal into <body> once
     ------------------------------------------------------------------ */
  function injectProfileModal() {
    if (document.getElementById('profileOverlay')) return;
    var div = document.createElement('div');
    div.innerHTML = PROFILE_MODAL_HTML;
    while (div.firstChild) {
      document.body.appendChild(div.firstChild);
    }
  }

  /* ------------------------------------------------------------------
      Global User Profile State
      ------------------------------------------------------------------ */
  var LS_KEY_NAME = 'ripple_user_name';
  var LS_KEY_THEME = 'ripple_theme';

  function getUserName() {
    if (window.Auth && window.Auth.user) {
      return window.Auth.user.name || window.Auth.user.username || 'Explorer';
    }
    var stored = localStorage.getItem(LS_KEY_NAME);
    if (stored && stored.trim()) return stored.trim();
    return 'Explorer';
  }

  function setUserName(name) {
    if (!name || !name.trim()) return;
    localStorage.setItem(LS_KEY_NAME, name.trim());
  }

  /**
   * updateUserProfileUI(name)
   * Syncs ALL DOM nodes that display the user name.
   * Call this after localStorage changes or on page init.
   */
  window.updateUserProfileUI = function(name) {
    if (!name) name = getUserName();
    var safeName = name.trim();
    var initial = safeName.charAt(0).toUpperCase();

    var greetingEl = document.getElementById('home-greeting-name');
    if (greetingEl) greetingEl.textContent = safeName;

    var sidebarNameEl = document.getElementById('sidebar-user-name');
    if (sidebarNameEl) sidebarNameEl.textContent = safeName;

    var sidebarAvatarEl = document.getElementById('sidebar-user-avatar');
    if (sidebarAvatarEl) sidebarAvatarEl.textContent = initial;

    var profileAvatarEl = document.getElementById('profileAvatarLetter');
    if (profileAvatarEl) profileAvatarEl.textContent = initial;

    var editInput = document.getElementById('editUserName');
    if (editInput) editInput.value = safeName;
  };

  /**
   * initUserProfile()
   * Sets user display from auth state, falls back to localStorage.
   */
  function initUserProfile() {
    if (window.Auth && window.Auth.user) {
      var name = window.Auth.user.name || window.Auth.user.username;
      if (name) {
        setUserName(name);
        updateUserProfileUI(name);
        return;
      }
    }

    var fetchFn = (window.Auth && window.Auth.fetch) ? window.Auth.fetch : fetch;
    fetchFn('/api/settings')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then(function(settings) {
        if (settings && settings.user_name) {
          setUserName(settings.user_name);
        } else if (!localStorage.getItem(LS_KEY_NAME)) {
          localStorage.setItem(LS_KEY_NAME, 'Explorer');
        }
        updateUserProfileUI();
      })
      .catch(function() {
        if (!localStorage.getItem(LS_KEY_NAME)) {
          localStorage.setItem(LS_KEY_NAME, 'Explorer');
        }
        updateUserProfileUI();
      });
  }

  /* ------------------------------------------------------------------
     Theme (Dark Mode) State
     ------------------------------------------------------------------ */
  function getTheme() {
    var stored = localStorage.getItem(LS_KEY_THEME);
    if (stored === 'dark' || stored === 'light') return stored;
    return 'light';
  }

  function setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') return;
    localStorage.setItem(LS_KEY_THEME, theme);
    applyTheme(theme);
  }

  function applyTheme(theme) {
    var html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    var toggle = document.getElementById('darkModeToggle');
    if (toggle) {
      toggle.checked = (theme === 'dark');
    }
  }

  function initTheme() {
    if (!localStorage.getItem(LS_KEY_THEME)) {
      localStorage.setItem(LS_KEY_THEME, 'light');
    }
    applyTheme(getTheme());
  }

  /* ------------------------------------------------------------------
     Nav active state
     ------------------------------------------------------------------ */
  function setActiveNav(page) {
    var items = document.querySelectorAll('.sidenav-item');
    items.forEach(function(item) {
      item.classList.remove('bg-teal-50', 'text-teal-700');
      item.classList.add('text-gray-600', 'hover:bg-gray-50');
      if (item.getAttribute('data-nav') === page) {
        item.classList.add('bg-teal-50', 'text-teal-700');
        item.classList.remove('text-gray-600', 'hover:bg-gray-50');
      }
    });
  }

  /* ------------------------------------------------------------------
     Inject sidebar into #globalSidebar (non-reader pages)
     ------------------------------------------------------------------ */
  function injectSidebar(html) {
    var container = document.getElementById('globalSidebar');
    if (!container) return;
    container.innerHTML = html;
    setActiveNav(activePage);
  }

  /* ------------------------------------------------------------------
     Reader page: augment the existing collapsible sidebar
     ------------------------------------------------------------------ */
  function augmentReaderSidebar() {
    var aside = document.querySelector('aside[id]') || document.querySelector('body > aside');
    if (!aside) return;

    // Only inject Settings button if not already present
    if (document.getElementById('sidebarSettingsBtn')) return;

    var nav = aside.querySelector('nav');
    if (!nav) return;

    var settingsLink = document.createElement('a');
    settingsLink.href = '#';
    settingsLink.id = 'sidebarSettingsBtn';
    settingsLink.className = 'flex items-center justify-center group-hover:justify-start gap-3 py-3 px-3 hover:bg-gray-50 rounded-xl text-gray-600 font-medium transition-all';
    settingsLink.innerHTML =
      '<svg class="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>' +
      '</svg>' +
      '<span class="font-sans opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto transition-all duration-300 whitespace-nowrap">Settings</span>';
    nav.appendChild(settingsLink);
  }

  /* ==================================================================
     Settings Modal Logic
     ================================================================== */
  var isSettingsSaving = false;
  var settingsDebounceTimer = null;
  var cachedSettings = null;

  function bindSettingsEvents() {
    var closeBtn = document.getElementById('settingsModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeSettingsModal);

    var backdrop = document.getElementById('settingsBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeSettingsModal);

    var cancelBtn = document.getElementById('settingsBtnCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSettingsModal);

    var saveBtn = document.getElementById('settingsBtnSave');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);

    var tabBtns = document.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tab = this.getAttribute('data-tab');
        if (tab) switchSettingsTab(tab);
      });
    });

    var fontSizeSlider = document.getElementById('fontSizeSlider');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', function() {
        debouncedFontSizeChange(this.value);
      });
    }

    var lineHeightSlider = document.getElementById('lineHeightSlider');
    if (lineHeightSlider) {
      lineHeightSlider.addEventListener('input', function() {
        debouncedLineHeightChange(this.value);
      });
    }

    var lexileSlider = document.getElementById('lexileSlider');
    if (lexileSlider) {
      lexileSlider.addEventListener('input', function() {
        var val = parseInt(this.value, 10);
        var label = document.getElementById('lexileValue');
        if (label) label.textContent = val + 'L';
      });
    }

    var darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('change', function() {
        var theme = this.checked ? 'dark' : 'light';
        setTheme(theme);
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('settingsOverlay');
        if (overlay && overlay.classList.contains('s--open')) {
          closeSettingsModal();
        }
      }
    });
  }

  function debouncedFontSizeChange(value) {
    var numVal = parseInt(value, 10);
    var label = document.getElementById('fontSizeValue');
    if (label) label.textContent = numVal + 'px';
    if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
    settingsDebounceTimer = setTimeout(function() {
      applyAppearanceSettings(numVal, null);
    }, 50);
  }

  function debouncedLineHeightChange(value) {
    var numVal = parseFloat(value);
    var label = document.getElementById('lineHeightValue');
    if (label) label.textContent = numVal.toFixed(1);
    if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
    settingsDebounceTimer = setTimeout(function() {
      applyAppearanceSettings(null, numVal);
    }, 50);
  }

  function applyAppearanceSettings(fontSize, lineHeight) {
    if (fontSize !== null && fontSize !== undefined) {
      document.documentElement.style.setProperty('--reader-font-size', fontSize + 'px');
    }
    if (lineHeight !== null && lineHeight !== undefined) {
      document.documentElement.style.setProperty('--reader-line-height', lineHeight);
    }
  }

  function openSettingsModal() {
    if (isSettingsSaving) return;
    var overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;
    overlay.classList.add('s--open');
    loadSettings();
  }

  function closeSettingsModal() {
    if (isSettingsSaving) return;
    var overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;
    overlay.classList.remove('s--open');
    if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
  }

  function switchSettingsTab(tabName) {
    var tabBtns = document.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(function(btn) {
      btn.classList.remove('s--active');
      if (btn.getAttribute('data-tab') === tabName) btn.classList.add('s--active');
    });
    var panels = document.querySelectorAll('.settings-tab-panel');
    panels.forEach(function(panel) {
      panel.classList.remove('s--active');
      if (panel.getAttribute('data-panel') === tabName) panel.classList.add('s--active');
    });
  }

  async function loadSettings() {
    try {
      var fetchFn = (window.Auth && window.Auth.fetch) ? window.Auth.fetch : fetch.bind(window);
      var response = await fetchFn('/api/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      var settings = await response.json();
      cachedSettings = settings;
      populateSettingsForm(settings);
      applyAppearanceSettings(settings.font_size, settings.line_height);
    } catch (error) {
      console.error('Error loading settings:', error);
      applyAppearanceSettings(18, 1.6);
    }
  }

  function populateSettingsForm(settings) {
    var el;
    el = document.getElementById('fontSizeSlider');
    if (el && settings.font_size !== undefined) el.value = settings.font_size;
    el = document.getElementById('fontSizeValue');
    if (el && settings.font_size !== undefined) el.textContent = settings.font_size + 'px';

    el = document.getElementById('lineHeightSlider');
    if (el && settings.line_height !== undefined) el.value = settings.line_height;
    el = document.getElementById('lineHeightValue');
    if (el && settings.line_height !== undefined) el.textContent = parseFloat(settings.line_height).toFixed(1);

    el = document.getElementById('lexileSlider');
    if (el && settings.target_lexile !== undefined) el.value = settings.target_lexile;
    el = document.getElementById('lexileValue');
    if (el && settings.target_lexile !== undefined) el.textContent = settings.target_lexile + 'L';

    el = document.getElementById('nativeLanguageSelect');
    if (el && settings.native_language) el.value = settings.native_language;

    el = document.getElementById('darkModeToggle');
    if (el) el.checked = (getTheme() === 'dark');
  }

  async function saveSettings() {
    if (isSettingsSaving) return;
    isSettingsSaving = true;

    var saveBtn = document.getElementById('settingsBtnSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    var payload = {};
    var el;
    el = document.getElementById('fontSizeSlider');
    if (el) payload.font_size = parseInt(el.value, 10);
    el = document.getElementById('lineHeightSlider');
    if (el) payload.line_height = parseFloat(el.value);
    el = document.getElementById('lexileSlider');
    if (el) payload.target_lexile = parseInt(el.value, 10);
    el = document.getElementById('nativeLanguageSelect');
    if (el) payload.native_language = el.value;

    payload.theme = getTheme();

    try {
      var fetchFn = (window.Auth && window.Auth.fetch) ? window.Auth.fetch : fetch.bind(window);
      var response = await fetchFn('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to save settings');
      var updated = await response.json();
      cachedSettings = updated;
      closeSettingsModal();
      setTimeout(function() { rippleToast('Settings saved', 'success'); }, 350);
    } catch (error) {
      console.error('Error saving settings:', error);
      rippleToast('Failed to save settings', 'error');
    } finally {
      isSettingsSaving = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save & Close'; }
    }
  }

  /* ==================================================================
     Profile Modal Logic
     ================================================================== */
  var isProfileSaving = false;

  function bindProfileEvents() {
    var profileOverlay = document.getElementById('profileOverlay');
    if (!profileOverlay) return;

    var closeBtn = document.getElementById('profileModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeProfileModal);

    var backdrop = document.getElementById('profileBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeProfileModal);

    var cancelBtn = document.getElementById('profileBtnCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeProfileModal);

    var saveBtn = document.getElementById('profileBtnSave');
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);

    var inputEl = document.getElementById('editUserName');
    if (inputEl) {
      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') saveProfile();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('profileOverlay');
        if (overlay && overlay.classList.contains('p--open')) {
          closeProfileModal();
        }
      }
    });
  }

  function openProfileModal() {
    if (isProfileSaving) return;
    var overlay = document.getElementById('profileOverlay');
    if (!overlay) return;
    var inputEl = document.getElementById('editUserName');
    if (inputEl) inputEl.value = getUserName();
    updateUserProfileUI();
    overlay.classList.add('p--open');
    setTimeout(function() {
      if (inputEl) { inputEl.focus(); inputEl.select(); }
    }, 150);
  }

  function closeProfileModal() {
    if (isProfileSaving) return;
    var overlay = document.getElementById('profileOverlay');
    if (!overlay) return;
    overlay.classList.remove('p--open');
  }

  async function saveProfile() {
    if (isProfileSaving) return;
    isProfileSaving = true;

    var saveBtn = document.getElementById('profileBtnSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    var inputEl = document.getElementById('editUserName');
    if (!inputEl) { isProfileSaving = false; return; }

    var newName = inputEl.value.trim();
    if (!newName) {
      rippleToast('Name cannot be empty', 'error');
      isProfileSaving = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      return;
    }

    setUserName(newName);
    updateUserProfileUI(newName);

    try {
      var fetchFn = (window.Auth && window.Auth.fetch) ? window.Auth.fetch : fetch.bind(window);
      await fetchFn('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: newName })
      });
    } catch (err) {
      console.error('Failed to sync user_name to backend:', err);
    }

    closeProfileModal();
    setTimeout(function() { rippleToast('Profile updated!', 'success'); }, 350);

    isProfileSaving = false;
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
  }

  /* ------------------------------------------------------------------
     Bootstrap — entry point
     ------------------------------------------------------------------ */
  function boot() {
    activePage = detectPage();
    injectSettingsModal();
    injectProfileModal();
    initUserProfile();
    initTheme();

    if (activePage === 'reader') {
      augmentReaderSidebar();
      bindSettingsEvents();
      bindProfileEvents();
      bindUserMenu();
      return;
    }

    fetch(SIDEBAR_HTML_URL)
      .then(function(res) {
        if (!res.ok) throw new Error('sidebar.html not found');
        return res.text();
      })
      .then(function(html) {
        injectSidebar(html);
        bindSettingsEvents();
        bindProfileEvents();
        bindUserMenu();
        updateUserProfileUI();
      })
      .catch(function(err) {
        console.error('Sidebar load failed:', err);
      });
  }

  /* ------------------------------------------------------------------
     User Dropdown Menu
     ------------------------------------------------------------------ */
  function bindUserMenu() {
    var userBtn = document.getElementById('sidebarUserBtn');
    var menu = document.getElementById('sidebarUserMenu');
    var chevron = document.getElementById('sidebarUserChevron');

    if (!userBtn || !menu) return;

    // Toggle menu on user button click
    userBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = !menu.classList.contains('hidden');
      if (isOpen) {
        closeUserMenu();
      } else {
        menu.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
    });

    // Close menu on outside click
    document.addEventListener('click', function(e) {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== userBtn && !userBtn.contains(e.target)) {
        closeUserMenu();
      }
    });

    function closeUserMenu() {
      menu.classList.add('hidden');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }

    // Menu item: Edit Profile
    var profileBtn = document.getElementById('sidebarMenuProfile');
    if (profileBtn) {
      profileBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeUserMenu();
        var profileOverlay = document.getElementById('profileOverlay');
        if (profileOverlay) {
          var inputEl = document.getElementById('editUserName');
          if (inputEl) inputEl.value = getUserName();
          updateUserProfileUI();
          profileOverlay.classList.add('p--open');
          setTimeout(function() {
            if (inputEl) { inputEl.focus(); inputEl.select(); }
          }, 150);
        }
      });
    }

    // Menu item: Settings
    var settingsBtn = document.getElementById('sidebarMenuSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeUserMenu();
        openSettingsModal();
      });
    }

    // Menu item: Logout
    var logoutBtn = document.getElementById('sidebarMenuLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeUserMenu();
        if (window.Auth && window.Auth.logout) {
          window.Auth.logout();
        } else {
          localStorage.clear();
          window.location.href = '/login.html';
        }
      });
    }

    // Old settings button (for reader page compatibility)
    var oldSettingsBtn = document.getElementById('sidebarSettingsBtn');
    if (oldSettingsBtn) {
      oldSettingsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        openSettingsModal();
      });
    }

    // Old profile button (for reader page compatibility)
    var oldProfileBtn = document.getElementById('sidebarUserArea');
    if (oldProfileBtn) {
      oldProfileBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var profileOverlay = document.getElementById('profileOverlay');
        if (profileOverlay) {
          var inputEl = document.getElementById('editUserName');
          if (inputEl) inputEl.value = getUserName();
          updateUserProfileUI();
          profileOverlay.classList.add('p--open');
          setTimeout(function() {
            if (inputEl) { inputEl.focus(); inputEl.select(); }
          }, 150);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
