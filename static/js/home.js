/**
 * home.js — Dashboard data wiring
 * Fetches /api/home/dashboard and renders all widgets.
 * Real book covers only, no Morandi filters.
 */
(function () {
    'use strict';

    var ARTICLE_THUMBS = [
        'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=400',
        'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=400',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400',
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400'
    ];

    function esc(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function buildCoverImg(book) {
        var coverUrl = book?.cover_url;
        var title = book?.title || 'Untitled';
        var firstChar = esc(title.charAt(0).toUpperCase());
        if (coverUrl && coverUrl.indexOf('http') === 0 && coverUrl.indexOf('placehold.co') === -1) {
            return '<div class="recs-card__cover">'
                + '<img src="' + esc(coverUrl) + '" alt="' + esc(title) + '" loading="lazy"'
                + ' onerror="this.parentElement.classList.add(\'recs-card__cover--fallback\');this.outerHTML=\'<span class=\\\'recs-card__cover-words\\\'>' + firstChar + '</span>\';">'
                + '</div>';
        }
        return '<div class="recs-card__cover recs-card__cover--fallback">'
            + '<span class="recs-card__cover-words">' + esc(title) + '</span>'
            + '</div>';
    }

    function buildRecCard(book) {
        var reason = book?.recommendation_reason || 'Editor\'s choice';
        var title = book?.title || 'Untitled';
        var author = book?.author || 'Unknown Author';
        var lexile = (book?.lexile_level != null) ? book.lexile_level : 'N/A';
        var match = (book?.match_percentage != null) ? book.match_percentage : '';
        var badgeText = reason + (match !== '' ? ' \u00b7 ' + match + '% match' : '');

        return '<div class="recs-card" data-book-id="' + (book?.id || '') + '">'
            + buildCoverImg(book)
            + '<div class="recs-card__info">'
            + '<span class="recs-card__badge">' + esc(reason) + '</span>'
            + '<div class="recs-card__title">' + esc(title) + '</div>'
            + '<div class="recs-card__author">' + esc(author) + '</div>'
            + '<span class="recs-card__lexile">' + lexile + 'L</span>'
            + '</div></div>';
    }

    function renderRecs(books) {
        var stage = document.getElementById('recsScroll');
        if (!stage) return;
        if (!books || !books.length) { stage.innerHTML = ''; return; }
        var html = '';
        for (var i = 0; i < books.length; i++) { html += buildRecCard(books[i]); }
        stage.innerHTML = html;
        ensureRecsArrow();
        bindRecsArrow(stage);
    }

    function ensureRecsArrow() {
        if (document.getElementById('recsArrow')) return;
        var wrap = document.querySelector('.recs-scroll-wrap');
        if (!wrap) {
            var scrollEl = document.getElementById('recsScroll');
            if (!scrollEl) return;
            var parent = scrollEl.parentElement;
            wrap = document.createElement('div');
            wrap.className = 'recs-scroll-wrap';
            parent.insertBefore(wrap, scrollEl);
            wrap.appendChild(scrollEl);
        }
        var arrow = document.createElement('button');
        arrow.id = 'recsArrow';
        arrow.className = 'recs-arrow';
        arrow.setAttribute('aria-label', 'Scroll next');
        arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        wrap.appendChild(arrow);
    }

    function bindRecsArrow(stage) {
        var arrow = document.getElementById('recsArrow');
        if (!arrow) return;
        var newArrow = arrow.cloneNode(true);
        arrow.parentNode.replaceChild(newArrow, arrow);
        newArrow.addEventListener('click', function () {
            stage.scrollBy({ left: stage.clientWidth * 0.75, behavior: 'smooth' });
        });
    }

    /* ── Continue Reading ────────────────────── */
    function buildContinueReading(book) {
        var title = book?.title || 'Untitled';
        var author = book?.author || 'Unknown Author';
        var coverUrl = book?.cover_url || '';
        var lexile = (book?.lexile_level != null) ? book.lexile_level : 800;
        var bookId = book?.id || '';
        var chapter = book?.current_chapter || 1;
        var totalChapters = book?.total_chapters || 1;
        var prog = book?.progress_percentage || 0;
        var estMin = book?.minutes_left || 0;

        var coverHtml;
        if (coverUrl && coverUrl.indexOf('http') === 0 && coverUrl.indexOf('placehold.co') === -1) {
            coverHtml = '<div class="cont-read__cover">'
                + '<img src="' + esc(coverUrl) + '" alt="" loading="lazy"'
                + ' onerror="this.parentElement.classList.add(\'cont-read__cover--placeholder\');this.outerHTML=\'<svg class=\\\'cont-read__cover-icon\\\' viewBox=\\\'0 0 24 24\\\' fill=\\\'none\\\' stroke=\\\'currentColor\\\' stroke-width=\\\'1.5\\\'><path d=\\\'M4 19.5A2.5 2.5 0 016.5 17H20\\\'/><path d=\\\'M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z\\\'/></svg>\';">'
                + '</div>';
        } else {
            coverHtml = '<div class="cont-read__cover cont-read__cover--placeholder">'
                + '<svg class="cont-read__cover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">'
                + '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'
                + '</svg></div>';
        }

        var url = 'reader.html?id=' + bookId;

        return '<div class="cont-read" data-resume-url="' + url + '">'
            + '<div class="cont-read__head">'
            + '<h3 class="cont-read__heading">Continue Reading</h3>'
            + '<button class="cont-read__menu" type="button" aria-label="More options">⋮</button>'
            + '</div>'
            + coverHtml
            + '<div class="cont-read__body">'
            + '<span class="cont-read__status"><span></span>In Progress</span>'
            + '<h3 class="cont-read__title">' + esc(title) + '</h3>'
            + (author ? '<p class="cont-read__author">' + esc(author) + ' \u00b7 ' + lexile + 'L</p>' : '')
            + '<p class="cont-read__chapter-title">Chapter ' + chapter + ': Keep going</p>'
            + '<div class="cont-read__meta-row">'
            + '<span class="cont-read__chapter">Chapter ' + chapter + ' of ' + totalChapters + '</span>'
            + '<span class="cont-read__time">~' + estMin + ' min left</span>'
            + '</div>'
            + '<div class="cont-read__progress-wrap">'
            + '<div class="cont-read__progress-bar"><div class="cont-read__progress-fill" style="width:' + prog + '%"></div></div>'
            + '<span class="cont-read__progress-num">' + prog + '%</span>'
            + '</div>'
            + '</div>'
            + '<button class="cont-read__resume">'
            + '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg>'
            + 'Resume Reading'
            + '</button>'
            + '</div>';
    }

    function renderContinueReading(book) {
        var inner = document.getElementById('dashContinueInner');
        if (!inner) return;
        if (book?._error || book == null) {
            inner.innerHTML = '<div class="cont-read cont-read--empty">'
                + '<span class="cont-read__label">Start your reading journey</span>'
                + '<button class="cont-read__resume" style="position:static;margin-top:12px;" onclick="window.location.href=\'book_library.html\'">'
                + '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16"/></svg>'
                + 'Explore Books'
                + '</button>'
                + '</div>';
            return;
        }
        inner.innerHTML = buildContinueReading(book);
    }

    /* ── Articles (horizontal layout) ────────── */
    function buildArticleCard(a, idx) {
        var articleSources = ['BBC News', 'The Guardian', 'National Geographic', 'Reuters', 'The Atlantic', 'Wired'];
        var src = a?.source || articleSources[idx % articleSources.length];
        var thumb = ARTICLE_THUMBS[idx % ARTICLE_THUMBS.length];
        var lexile = (a?.lexile_level != null) ? a.lexile_level : 'N/A';
        var readTime = a?.predicted_read_time || 8;
        return '<div class="article-card" data-article-id="' + (a?.id || '') + '">'
            + '<div class="article-card__thumb">'
            + '<img src="' + thumb + '" alt="" loading="lazy"'
            + ' onerror="this.outerHTML=\'<div style=\\\'width:100%;height:100%;background:#E8E5DF;display:flex;align-items:center;justify-content:center;font-family:Source Serif Pro,Georgia,serif;font-size:1.2rem;font-weight:700;color:#B0ADA5;\\\'>' + esc(src.charAt(0).toUpperCase()) + '</div>\';">'
            + '<span class="article-card__source">' + esc(src) + '</span>'
            + '</div>'
            + '<div class="article-card__body">'
            + '<span class="article-card__category">Psychology</span>'
            + '<h4 class="article-card__title">' + esc(a?.title || 'Untitled') + '</h4>'
            + '<p class="article-card__summary">Small changes that make a big difference in your reading journey.</p>'
            + '<div class="article-card__footer">'
            + '<span class="article-card__read-time">~' + readTime + ' min read</span>'
            + '<span class="article-card__lexile">' + lexile + 'L</span>'
            + '</div></div></div>';
    }

    function renderArticles(articles) {
        var grid = document.getElementById('articlesGrid');
        if (!grid) return;
        if (!articles || !articles.length) {
            grid.innerHTML = '';
            return;
        }
        var html = '';
        for (var i = 0; i < Math.min(articles.length, 2); i++) { html += buildArticleCard(articles[i], i); }
        grid.innerHTML = html;
    }

    /* ── Stats Capsule ────────────────────────── */
    function renderStats(stats) {
        var el = document.getElementById('statsCapsule');
        if (!el) return;
        var deltas = stats?.deltas || {};
        var items = [
            { icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>', value: stats?.time_this_week || '0h', label: 'Hours Read', delta: deltas.time_delta || '' },
            { icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', value: (stats?.books_read || 0), label: 'Books Finished', delta: deltas.books_delta || '' },
            { icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>', value: stats?.words_saved || 0, label: 'Highlights', delta: deltas.words_delta || '' },
            { icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', value: stats?.day_streak || 0, label: 'Notes Taken', delta: deltas.streak_delta || '' }
        ];
        el.innerHTML = items.map(function (s) {
            return '<div class="stat-item">'
                + '<div class="stat-item__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + s.icon + '</svg></div>'
                + '<div class="stat-item__text">'
                + '<span class="stat-item__value">' + s.value + '</span>'
                + '<span class="stat-item__label">' + s.label + '</span>'
                + '<span class="stat-item__delta">' + s.delta + '</span>'
                + '</div></div>';
        }).join('');
    }

    /* ── Goal: ring + chart ────────────────────── */
    var _goalTarget = 30;

    function updateGoalRing(pct, todayMin, goalMin) {
        var dash = 97.39;
        var offset = dash - (dash * Math.min(pct, 100) / 100);
        var fill = document.getElementById('goalRingFill');
        if (fill) {
            fill.style.strokeDashoffset = offset;
        }
        var valEl = document.getElementById('goalValue');
        if (valEl) valEl.textContent = String(todayMin);
        var unitEl = document.getElementById('goalUnit');
        if (unitEl) unitEl.textContent = '/ ' + goalMin + ' min';
        if (pct >= 100) {
            if (fill) fill.style.stroke = 'var(--rr-green-2)';
        } else {
            if (fill) fill.style.stroke = '';
        }
    }

    function openGoalEditor() {
        var existing = document.getElementById('goalEditor');
        if (existing) return;
        var center = document.querySelector('.goal-ring__center');
        if (!center) return;
        var editor = document.createElement('div');
        editor.id = 'goalEditor';
        editor.className = 'goal-editor';
        editor.innerHTML = '<input type="number" class="goal-editor__input" id="goalEditorInput" min="5" max="240" value="' + _goalTarget + '" placeholder="min"><span class="goal-editor__error" id="goalEditorError"></span><div class="goal-editor__actions"><button class="goal-editor__btn goal-editor__btn--cancel" id="goalEditorCancel">Cancel</button><button class="goal-editor__btn goal-editor__btn--save" id="goalEditorSave">Save</button></div>';
        center.style.visibility = 'hidden';
        var ring = document.querySelector('.goal-ring');
        if (ring) ring.appendChild(editor);

        var input = document.getElementById('goalEditorInput');
        if (input) setTimeout(function () { input.focus(); input.select(); }, 50);

        function closeEditor() {
            if (editor.parentNode) editor.parentNode.removeChild(editor);
            center.style.visibility = '';
        }

        function saveGoal() {
            var val = parseInt(input.value, 10);
            var errorEl = document.getElementById('goalEditorError');
            if (isNaN(val) || val < 5) {
                if (errorEl) errorEl.textContent = 'Min 5 min';
                return;
            }
            if (val > 240) {
                if (errorEl) errorEl.textContent = 'Max 240 min';
                return;
            }
            if (errorEl) errorEl.textContent = '';
            closeEditor();
            Auth.fetch('/api/home/dashboard/goal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal_minutes: val })
            }).then(function (r) { return r.json(); })
              .then(function (d) {
                  if (d?.code === 0) {
                      _goalTarget = val;
                      refreshGoalOnly();
                  } else {
                      loadDashboard();
                  }
              })
              .catch(function () {
                  loadDashboard();
              });
        }

        document.getElementById('goalEditorSave').addEventListener('click', saveGoal);
        document.getElementById('goalEditorCancel').addEventListener('click', closeEditor);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') saveGoal();
            if (e.key === 'Escape') closeEditor();
        });
    }

    function refreshGoalOnly() {
        Auth.fetch('/api/home/dashboard')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d?.code === 0 && d?.data) {
                    renderGoal(d.data.goal, d.data.user_stats);
                    try {
                        var cached = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || '{}');
                        if (cached?.data) {
                            cached.data.goal = d.data.goal;
                            cached.data.user_stats = d.data.user_stats;
                            localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cached));
                        }
                    } catch (e) {}
                }
            })
            .catch(function () { loadDashboard(); });
    }

    function renderGoal(goal, userStats) {
        goal = goal || {};
        _goalTarget = (goal.goal_minutes != null) ? goal.goal_minutes : ((userStats?.goal_minutes != null) ? userStats.goal_minutes : 30);
        var pct = (goal.progress_percent != null) ? goal.progress_percent : 0;
        var todayMin = (goal.today_minutes != null) ? goal.today_minutes : 0;
        updateGoalRing(pct, todayMin, _goalTarget);

        var streakEl = document.getElementById('dashStreak');
        if (streakEl && goal.streak_days != null) {
            var sd = goal.streak_days;
            if (sd === 0) {
                streakEl.textContent = 'Start your streak today';
            } else if (sd === 1) {
                streakEl.textContent = '1-day streak';
            } else {
                streakEl.textContent = sd + '-day streak';
            }
        }

        var ctaEl = document.getElementById('goalCta');
        if (ctaEl) {
            ctaEl.textContent = goal.cta_text || '';
        }

        var subEl = document.getElementById('goalSub');
        if (subEl) {
            subEl.textContent = goal.sub_text || '';
        }

        var chart = (goal.weekly_chart != null && goal.weekly_chart.some(function(v) { return v > 0; }))
            ? goal.weekly_chart
            : [];
        var chartEl = document.getElementById('goalChart');
        if (chartEl) {
            var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            var todayIdx = new Date().getDay();
            var todayMon = todayIdx === 0 ? 6 : todayIdx - 1;
            var maxVal = 1;
            if (chart.length > 0) {
                for (var i = 0; i < chart.length; i++) {
                    if (chart[i] > maxVal) maxVal = chart[i];
                }
            } else {
                chart = [0, 0, 0, 0, 0, 0, 0];
            }
            var barsHtml = '';
            var labelsHtml = '';
            for (var i = 0; i < 7; i++) {
                var value = chart[i] || 0;
                var isFuture = i > todayMon;
                var h = value > 0 ? Math.max(6, Math.min(54, value / maxVal * 54)) : 6;
                var cls = 'goal-chart__bar';
                if (value > 0) cls += ' is--complete';
                if (isFuture) cls += ' is--future';
                if (i === todayMon && value === 0) cls += ' is--today';
                barsHtml += '<div class="' + cls + '" style="height:' + h + 'px"></div>';
                labelsHtml += '<span class="goal-chart__label">' + days[i] + '</span>';
            }
            chartEl.innerHTML = barsHtml;
            var labelsEl = document.getElementById('goalChartLabels');
            if (labelsEl) labelsEl.innerHTML = labelsHtml;
        }

        var centerEl = document.querySelector('.goal-ring__center');
        if (centerEl) {
            if (!centerEl._goalEditBound) {
                centerEl._goalEditBound = true;
                centerEl.addEventListener('click', openGoalEditor);
                centerEl.style.cursor = 'pointer';
            }
        }
    }

    /* ── Sidebar user injection ───────────────── */
    function injectSidebarUser(name) {
        var nameEl = document.getElementById('sidebar-user-name');
        if (nameEl) nameEl.textContent = name;
        var avatarEl = document.getElementById('sidebar-user-avatar');
        if (avatarEl && name) avatarEl.textContent = name.charAt(0).toUpperCase();
    }

    /* ── Click delegation ─────────────────────── */
    function bindClicks() {
        document.addEventListener('click', function (e) {
            var recCard = e.target.closest('.recs-card');
            if (recCard) {
                var id = recCard.getAttribute('data-book-id');
                if (id) { window.location.href = 'reader.html?id=' + id; return; }
            }
            var artCard = e.target.closest('.article-card');
            if (artCard) {
                var aid = artCard.getAttribute('data-article-id');
                if (aid) { window.location.href = 'reader.html?id=' + aid; return; }
            }
            var contRead = e.target.closest('.cont-read');
            if (contRead) {
                var url = contRead.getAttribute('data-resume-url');
                if (url) { window.location.href = url; return; }
            }
        });
    }

    /* ── Mobile menu toggle ──────────────────── */
    function bindMobileMenu() {
        var toggleBtn = document.getElementById('dashMenuToggle');
        var sidebar = document.getElementById('globalSidebarAside');
        var overlay = document.getElementById('dashSidebarOverlay');
        if (!toggleBtn || !sidebar) return;

        function openMenu() {
            sidebar.classList.add('is--open');
            if (overlay) overlay.classList.add('is--visible');
        }

        function closeMenu() {
            sidebar.classList.remove('is--open');
            if (overlay) overlay.classList.remove('is--visible');
        }

        toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (sidebar.classList.contains('is--open')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        if (overlay) {
            overlay.addEventListener('click', closeMenu);
        }

        window.addEventListener('resize', function () {
            if (window.innerWidth > 767 && sidebar.classList.contains('is--open')) {
                closeMenu();
            }
        });

        document.addEventListener('click', function (e) {
            if (!sidebar.classList.contains('is--open')) return;
            var insideSidebar = sidebar.contains(e.target);
            var isToggle = toggleBtn.contains(e.target);
            if (!insideSidebar && !isToggle) {
                closeMenu();
            }
        });
    }

    /* ── Fetch & Bootstrap ────────────────────── */
    var _fetching = false;

    function showRecsSkeletons() {
        var el = document.getElementById('recsScroll');
        if (!el) return;
        el.innerHTML = '';
        for (var i = 0; i < 4; i++) {
            el.innerHTML += '<div style="width:220px;flex-shrink:0;border-radius:16px;background:rgba(0,0,0,0.02);min-height:280px;animation:classics-shimmer 1.8s infinite;"></div>';
        }
    }

    var DASHBOARD_CACHE_KEY = 'rr_dashboard_v1';

    function renderDashboardData(data) {
        if (data.user_stats?.name) {
            var nameEl = document.getElementById('home-greeting-name');
            if (nameEl) nameEl.textContent = data.user_stats.name;
            injectSidebarUser(data.user_stats.name);
        }
        renderContinueReading(data.continue_reading);
        renderRecs(data.recommendations);
        renderArticles(data.articles);
        renderStats(data.stats);
        renderGoal(data.goal, data.user_stats);
    }

    function loadDashboard(retryCount) {
        if (_fetching) return;
        _fetching = true;
        retryCount = retryCount || 0;

        var hasCached = false;
        try {
            var cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (parsed?.data) {
                    renderDashboardData(parsed.data);
                    hasCached = true;
                }
            }
        } catch (e) {}

        if (!hasCached) showRecsSkeletons();

        var delay = hasCached ? 200 : 0;

        setTimeout(function () {
            Auth.fetch('/api/home/dashboard')
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function (d) {
                    if (d?.code === 0 && d?.data) {
                        try { localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(d)); } catch (e) {}
                        renderDashboardData(d.data);
                    } else {
                        renderContinueReading({ _error: true });
                    }
                })
                .catch(function (err) {
                    console.error('[Dashboard] Fetch error:', err);
                    if (retryCount < 2) {
                        _fetching = false;
                        setTimeout(function () { loadDashboard(retryCount + 1); }, 500 * (retryCount + 1));
                        return;
                    }
                    renderContinueReading({ _error: true });
                })
                .finally(function () {
                    _fetching = false;
                });
        }, delay);
    }

    /* ── Global Search ─────────────────────────── */
    var searchInput = document.getElementById('globalSearchInput');
    var searchDropdown = document.getElementById('searchDropdown');
    var searchResults = document.getElementById('searchResults');
    var searchLoading = document.getElementById('searchLoading');
    var searchEmpty = document.getElementById('searchEmpty');
    var searchDebounceTimer = null;
    var searchActiveIndex = -1;
    var searchItemEls = [];
    var searchAbortController = null;
    var searchCurrentQuery = '';

    /* ── Notifications ─────────────────────────── */
    var notifBell = document.getElementById('notificationBell');
    var notifDropdown = document.getElementById('notificationDropdown');
    var notifList = document.getElementById('notificationList');
    var notifLoading = document.getElementById('notificationLoading');
    var notifEmpty = document.getElementById('notificationEmpty');
    var notifDot = document.getElementById('notificationDot');
    var notifMarkAllBtn = document.getElementById('markAllReadBtn');

    var NOTIF_ICONS = {
        reading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
        content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        vocab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        platform: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>'
    };

    var BODY_LABELS = {
        'daily_goal': 'Daily reading goal achieved',
        'streak_7': '7-day streak milestone reached',
        'streak_30': '30-day streak milestone reached',
        'streak_100': '100-day streak milestone reached',
        'review_reminder': 'Vocabulary review due',
        'news_fetch': 'Fresh articles available in library',
    };

    function formatBody(body) {
        if (!body) return '';
        if (BODY_LABELS[body]) return BODY_LABELS[body];
        if (body.indexOf('book_finished_') === 0) return 'Book completed';
        if (body.indexOf('weaver_') === 0) return 'AI story ready';
        if (body.indexOf('streak_') === 0) return body.replace('streak_', '') + '-day streak milestone';
        return body;
    }

    function timeAgo(dateStr) {
        if (!dateStr) return '';
        var now = new Date();
        var then = new Date(dateStr.replace(' ', 'T') + 'Z');
        var diff = Math.floor((now - then) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function loadUnreadCount() {
        Auth.fetch('/api/notifications/unread-count')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.code === 0 && d.data) {
                    var count = d.data.count || 0;
                    if (count > 0) {
                        notifDot.style.display = 'block';
                        notifDot.textContent = count > 99 ? '99+' : count;
                        notifDot.style.width = 'auto';
                        notifDot.style.padding = '0 4px';
                        notifDot.style.minWidth = '16px';
                        notifDot.style.height = '16px';
                        notifDot.style.fontSize = '10px';
                        notifDot.style.color = '#FFF';
                        notifDot.style.textAlign = 'center';
                        notifDot.style.lineHeight = '16px';
                        notifDot.style.borderRadius = '8px';
                        notifDot.style.top = '4px';
                        notifDot.style.right = '4px';
                    } else {
                        notifDot.style.display = 'none';
                        notifDot.textContent = '';
                    }
                }
            })
            .catch(function () {});
    }

    function renderNotifications(notifs) {
        if (!notifs || !notifs.length) {
            notifLoading.style.display = 'none';
            notifList.innerHTML = '';
            notifEmpty.style.display = 'flex';
            notifMarkAllBtn.style.display = 'none';
            return;
        }

        notifLoading.style.display = 'none';
        notifEmpty.style.display = 'none';

        var hasUnread = false;
        var html = '';
        for (var i = 0; i < notifs.length; i++) {
            var n = notifs[i];
            var isUnread = n.is_read === 0;
            if (isUnread) hasUnread = true;
            var cls = 'notif-item' + (isUnread ? ' notif-item--unread' : '');
            var icon = NOTIF_ICONS[n.type] || NOTIF_ICONS.system;
            var iconCls = 'notif-item__icon--' + (n.type || 'system');
            var sourceTag = '';
            if (n.source === 'platform') {
                sourceTag = '<span class="notif-item__source-tag notif-item__source-tag--platform">ADMIN</span>';
            }
            html += '<div class="' + cls + '" data-notif-id="' + n.id + '" data-link="' + esc(n.link || '') + '">'
                + '<div class="notif-item__icon ' + iconCls + '">' + icon + '</div>'
                + '<div class="notif-item__body">'
                + '<div class="notif-item__title">' + esc(n.title) + sourceTag + '</div>'
                + (n.body ? '<div class="notif-item__body-text">' + esc(formatBody(n.body)) + '</div>' : '')
                + '<div class="notif-item__time">' + timeAgo(n.created_at) + '</div>'
                + '</div></div>';
        }
        notifList.innerHTML = html;

        if (hasUnread) {
            notifMarkAllBtn.style.display = 'block';
        } else {
            notifMarkAllBtn.style.display = 'none';
        }
    }

    function loadNotifications() {
        notifList.innerHTML = '';
        notifLoading.style.display = 'flex';
        notifEmpty.style.display = 'none';
        Auth.fetch('/api/notifications')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.code === 0 && d.data) {
                    renderNotifications(d.data);
                } else {
                    renderNotifications([]);
                }
            })
            .catch(function () {
                renderNotifications([]);
            });
    }

    function openNotifDropdown() {
        var headerRight = document.querySelector('.dash-header-row__right');
        if (headerRight) headerRight.style.position = 'relative';
        loadNotifications();
        notifDropdown.style.display = 'flex';
        if (searchDropdown) searchDropdown.style.display = 'none';
    }

    function closeNotifDropdown() {
        notifDropdown.style.display = 'none';
        loadUnreadCount();
    }

    function toggleNotifDropdown() {
        if (notifDropdown.style.display === 'flex') {
            closeNotifDropdown();
        } else {
            openNotifDropdown();
        }
    }

    if (notifBell) {
        notifBell.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleNotifDropdown();
        });
    }

    document.addEventListener('click', function (e) {
        var item = e.target.closest('.notif-item');
        if (item && notifDropdown.style.display === 'flex') {
            var id = item.getAttribute('data-notif-id');
            var link = item.getAttribute('data-link');
            if (id) {
                Auth.fetch('/api/notifications/' + id + '/read', { method: 'PUT' });
            }
            closeNotifDropdown();
            if (link) {
                window.location.href = link;
            }
            return;
        }

        if (e.target.id === 'markAllReadBtn' || e.target.closest('#markAllReadBtn')) {
            Auth.fetch('/api/notifications/mark-all-read', { method: 'POST' })
                .then(function () {
                    loadNotifications();
                    loadUnreadCount();
                });
            return;
        }

        if (notifDropdown.style.display === 'flex'
            && !notifDropdown.contains(e.target)
            && e.target !== notifBell
            && !notifBell.contains(e.target)) {
            closeNotifDropdown();
        }
    });

    loadUnreadCount();

    var SECTION_CONFIG = {
        library:  { label: 'My Library', icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M12 6v12"/><path d="M16 6v12"/>' },
        books:    { label: 'Classic Library', icon: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>' },
        vocabulary: { label: 'Vocabulary Notes', icon: '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>' }
    };

    function showSearchDropdown() {
        searchDropdown.style.display = 'block';
    }

    function hideSearchDropdown() {
        searchDropdown.style.display = 'none';
        searchLoading.style.display = 'none';
        searchResults.innerHTML = '';
        searchEmpty.style.display = 'none';
        searchActiveIndex = -1;
        searchItemEls = [];
    }

    function showLoading() {
        searchLoading.style.display = 'block';
        searchResults.innerHTML = '';
        searchEmpty.style.display = 'none';
    }

    function showEmpty() {
        searchLoading.style.display = 'none';
        searchResults.innerHTML = '';
        searchEmpty.style.display = 'flex';
    }

    function buildSearchResultHTML(data) {
        var hasAny = false;
        var html = '';
        var keys = ['library', 'books', 'vocabulary'];
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var items = data[key];
            if (!items || !items.length) continue;
            hasAny = true;
            var cfg = SECTION_CONFIG[key];
            html += '<div class="search-dropdown__section">';
            html += '<div class="search-dropdown__section-header">';
            html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + cfg.icon + '</svg>';
            html += '<span>' + cfg.label + '</span>';
            html += '</div>';
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var title = '', sub = '', iconClass = '';
                if (key === 'library') {
                    title = item.title || '';
                    sub = (item.author || '') + (item.type ? ' \u00b7 ' + item.type : '');
                    iconClass = 'search-dropdown__item-icon--library';
                } else if (key === 'books') {
                    title = item.title || '';
                    sub = item.author || '';
                    iconClass = 'search-dropdown__item-icon--books';
                } else if (key === 'vocabulary') {
                    title = item.word || '';
                    sub = item.translation || '';
                    iconClass = 'search-dropdown__item-icon--vocabulary';
                }
                html += '<div class="search-dropdown__item" data-section="' + key + '" data-id="' + item.id + '">';
                html += '<div class="search-dropdown__item-icon ' + iconClass + '">';
                html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + cfg.icon + '</svg>';
                html += '</div>';
                html += '<div class="search-dropdown__item-body">';
                html += '<div class="search-dropdown__item-title">' + (item.highlight || esc(title)) + '</div>';
                html += '<div class="search-dropdown__item-sub">' + esc(sub) + '</div>';
                html += '</div></div>';
            }
            html += '<div class="search-dropdown__footer" data-section="' + key + '" data-action="view-all">View all in ' + cfg.label + ' &rarr;</div>';
            html += '</div>';
        }
        if (!hasAny) {
            showEmpty();
            return;
        }
        searchResults.innerHTML = html;
        searchItemEls = searchResults.querySelectorAll('.search-dropdown__item');
        searchActiveIndex = -1;
        searchLoading.style.display = 'none';
        searchEmpty.style.display = 'none';
    }

    function doSearch(query) {
        if (!query || query.trim().length === 0) {
            hideSearchDropdown();
            return;
        }
        query = query.trim();
        searchCurrentQuery = query;
        showSearchDropdown();
        showLoading();

        if (searchAbortController) {
            searchAbortController.abort();
        }
        searchAbortController = new AbortController();

        Auth.fetch('/api/search?q=' + encodeURIComponent(query), { signal: searchAbortController.signal })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.code === 0 && d.data) {
                    buildSearchResultHTML(d.data);
                } else {
                    showEmpty();
                }
            })
            .catch(function (err) {
                if (err.name !== 'AbortError') {
                    showEmpty();
                }
            });
    }

    function navigateSearchItem(direction) {
        if (searchItemEls.length === 0) return;
        for (var i = 0; i < searchItemEls.length; i++) {
            searchItemEls[i].classList.remove('search-dropdown__item--active');
        }
        if (direction === 'down') {
            searchActiveIndex = (searchActiveIndex + 1) % searchItemEls.length;
        } else {
            searchActiveIndex = searchActiveIndex <= 0 ? searchItemEls.length - 1 : searchActiveIndex - 1;
        }
        var el = searchItemEls[searchActiveIndex];
        el.classList.add('search-dropdown__item--active');
        el.scrollIntoView({ block: 'nearest' });
    }

    function navigateToResult(section, id) {
        if (section === 'library') {
            window.location.href = 'reader.html?id=' + id;
        } else if (section === 'books') {
            window.location.href = 'book_library.html?highlight=' + id;
        } else if (section === 'vocabulary') {
            window.location.href = 'vocabulary.html?highlight=' + id;
        }
    }

    function activateSearchItem() {
        if (searchActiveIndex < 0 || searchActiveIndex >= searchItemEls.length) return;
        var el = searchItemEls[searchActiveIndex];
        var section = el.getAttribute('data-section');
        var id = el.getAttribute('data-id');
        navigateToResult(section, id);
    }

    function bindSearch() {
        if (!searchInput) return;

        searchInput.addEventListener('input', function () {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(function () {
                doSearch(searchInput.value);
            }, 300);
        });

        searchInput.addEventListener('focus', function () {
            if (searchInput.value.trim().length > 0) {
                doSearch(searchInput.value);
            }
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                hideSearchDropdown();
                searchInput.blur();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateSearchItem('down');
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateSearchItem('up');
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                activateSearchItem();
                return;
            }
        });

        searchInput.addEventListener('blur', function () {
            setTimeout(function () {
                if (document.activeElement !== searchDropdown && !searchDropdown.contains(document.activeElement)) {
                    hideSearchDropdown();
                }
            }, 200);
        });

        document.addEventListener('click', function (e) {
            if (!searchDropdown.contains(e.target) && e.target !== searchInput) {
                hideSearchDropdown();
            }
        });

        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });

        document.addEventListener('mousedown', function (e) {
            var footer = e.target.closest('.search-dropdown__footer');
            if (footer) {
                e.preventDefault();
                var section = footer.getAttribute('data-section');
                if (section === 'library') {
                    window.location.href = 'library.html?q=' + encodeURIComponent(searchCurrentQuery);
                } else if (section === 'books') {
                    window.location.href = 'book_library.html?q=' + encodeURIComponent(searchCurrentQuery);
                } else if (section === 'vocabulary') {
                    window.location.href = 'vocabulary.html?q=' + encodeURIComponent(searchCurrentQuery);
                }
                return;
            }
            var item = e.target.closest('.search-dropdown__item');
            if (!item) return;
            e.preventDefault();
            var section = item.getAttribute('data-section');
            var id = item.getAttribute('data-id');
            navigateToResult(section, id);
        });
    }

    function bootDashboard() {
        loadDashboard();
        bindClicks();
        bindMobileMenu();
        bindSearch();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootDashboard);
    } else {
        bootDashboard();
    }

    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            _fetching = false;
            bootDashboard();
        }
    });
})();

