/**
 * book_library.js — Full-Page Masonry Gallery
 *
 * Fetches /api/books, renders pure-CSS Morandi book covers into
 * the masonry grid. Supports debounced search + sort.
 */

(function () {
    'use strict';

    /* ── Morandi palette ─────────────────────── */
    var MORANDI_COLORS = [
        '#2D403E', '#4A5568', '#5C6B73', '#6B5B4F', '#7D6E63',
        '#8C7A6B', '#3D4F4A', '#4E5B50', '#5A4E4D', '#3E4A4B'
    ];

    var MORANDI_LIGHTS = [
        '#D2C9BD', '#E8E5DF', '#C5BFB5', '#D9D2C5', '#E0DCD3',
        '#CCC4B8', '#DFD9CE', '#C8C0B6', '#DBD5CA', '#D4CFC5'
    ];

    /* ── DOM refs ────────────────────────────── */
    var gridEl    = null;
    var countEl   = null;
    var searchEl  = null;
    var sortEl    = null;
    var clearEl   = null;

    /* ── State ───────────────────────────────── */
    var allBooks     = [];
    var filteredBooks = [];
    var currentSort  = 'id_desc';
    var currentQuery = '';
    var fetchLocked  = false;
    var searchTimer  = null;
    var SEARCH_DEBOUNCE = 300;

    /* ── Helpers ─────────────────────────────── */
    function hashStr(s) {
        var h = 0;
        for (var i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    function pickMorandi(title) {
        if (!title) return MORANDI_COLORS[0];
        var h = hashStr(title);
        return (h % 2 === 0)
            ? MORANDI_COLORS[h % MORANDI_COLORS.length]
            : MORANDI_LIGHTS[h % MORANDI_LIGHTS.length];
    }

    function isDark(hex) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
    }

    function coverWords(title) {
        if (!title) return 'Book';
        var words = title.replace(/\s+/g, ' ').trim().split(' ');
        var display = words.slice(0, 2).join(' ');
        if (display.length < 4 && words.length === 1) {
            return title.substring(0, 12);
        }
        return display;
    }

    function estimateReadTime() {
        var w = 70000 + Math.floor(Math.random() * 30000);
        var m = Math.max(1, Math.round(w / 200));
        return m >= 60 ? Math.round(m / 60 * 10) / 10 + 'h read' : m + ' mins read';
    }

    function esc(s) {
        var str = s ?? '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ── Card builder ────────────────────────── */
    function buildCard(book) {
        var bg = pickMorandi(book?.title);
        var dark = isDark(bg);
        var c = dark ? '255,255,255' : '30,41,59';
        var words = coverWords(book?.title);
        var author = book?.author ?? 'Unknown Author';
        var lexile = (book?.lexile_level != null) ? book.lexile_level : 'N/A';
        var title = book?.title ?? 'Untitled';

        return ''
            + '<div class="classics-card" data-book-id="' + (book?.id ?? '') + '" title="' + esc(title) + '">'
            + '  <div class="classics-card__cover" style="background-color:' + bg + ';">'
            + '    <div class="classics-card__cover-inner">'
            + '      <span class="classics-card__cover-words" style="color:rgba(' + c + ',' + (dark ? '0.92' : '0.85') + ');">' + esc(words) + '</span>'
            + '      <div class="classics-card__cover-rule" style="background:rgba(' + c + ',' + (dark ? '0.18' : '0.12') + ');"></div>'
            + '    </div>'
            + '    <span class="classics-card__cover-author" style="color:rgba(' + c + ',' + (dark ? '0.45' : '0.42') + ');">' + esc(author) + '</span>'
            + '  </div>'
            + '  <div class="classics-card__meta">'
            + '    <div class="classics-card__title" title="' + esc(title) + '">' + esc(title) + '</div>'
            + '    <div class="classics-card__footer">'
            + '      <span class="classics-card__read-time">' + estimateReadTime() + '</span>'
            + '      <span class="classics-card__lexile">' + lexile + 'L</span>'
            + '    </div>'
            + '  </div>'
            + '</div>';
    }

    /* ── Render ──────────────────────────────── */
    function renderBooks(books) {
        if (!gridEl) return;
        if (!books || !books.length) {
            gridEl.innerHTML = ''
                + '<div class="bl-no-results">'
                + '  <svg class="bl-no-results__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
                + '    <circle cx="11" cy="11" r="8"/>'
                + '    <line x1="21" y1="21" x2="16.65" y2="16.65"/>'
                + '  </svg>'
                + '  <p class="bl-no-results__text">No books match your search</p>'
                + '  <p class="bl-no-results__hint">Try a different title or author name</p>'
                + '</div>';
            if (countEl) countEl.textContent = '0 results';
            return;
        }

        var html = '';
        for (var i = 0; i < books.length; i++) {
            html += buildCard(books[i]);
        }
        gridEl.innerHTML = html;
        if (countEl) countEl.textContent = books.length + ' volumes';
    }

    /* ── Skeleton ────────────────────────────── */
    function showSkeletons() {
        if (!gridEl) return;
        var n = window.innerWidth < 768 ? 4 : (window.innerWidth < 1024 ? 6 : 9);
        var html = '<div class="classics-loading"><div class="classics-loading__grid">';
        for (var i = 0; i < n; i++) {
            html += '<div class="classics-loading__skeleton"></div>';
        }
        html += '</div></div>';
        gridEl.innerHTML = html;
        if (countEl) countEl.textContent = 'Loading\u2026';
    }

    function showError(msg) {
        if (!gridEl) return;
        gridEl.innerHTML = ''
            + '<div class="classics-loading">'
            + '  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5">'
            + '    <circle cx="12" cy="12" r="10"/>'
            + '    <line x1="12" y1="8" x2="12" y2="12"/>'
            + '    <line x1="12" y1="16" x2="12.01" y2="16"/>'
            + '  </svg>'
            + '  <span style="font-family:Inter,sans-serif;font-size:0.85rem;color:#94A3B8;">' + (msg ?? 'Unable to load books') + '</span>'
            + '</div>';
        if (countEl) countEl.textContent = '';
    }

    function showEmpty() {
        if (!gridEl) return;
        gridEl.innerHTML = ''
            + '<div class="classics-loading">'
            + '  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5">'
            + '    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>'
            + '    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'
            + '  </svg>'
            + '  <span style="font-family:Inter,sans-serif;font-size:0.85rem;color:#94A3B8;">No books found. Run the fetch script first.</span>'
            + '</div>';
        if (countEl) countEl.textContent = '';
    }

    /* ── Filter ──────────────────────────────── */
    function filterBooks(query) {
        currentQuery = query || '';
        var q = currentQuery.trim().toLowerCase();
        if (!q) {
            filteredBooks = allBooks.slice();
        } else {
            filteredBooks = [];
            for (var i = 0; i < allBooks.length; i++) {
                var book = allBooks[i];
                var title = (book?.title ?? '').toLowerCase();
                var author = (book?.author ?? '').toLowerCase();
                if (title.indexOf(q) !== -1 || author.indexOf(q) !== -1) {
                    filteredBooks.push(book);
                }
            }
        }
        renderBooks(filteredBooks);
    }

    /* ── Sort ────────────────────────────────── */
    function applySort() {
        if (currentSort === 'id_desc') {
            filteredBooks.sort(function (a, b) { return (b?.id ?? 0) - (a?.id ?? 0); });
        } else if (currentSort === 'id_asc') {
            filteredBooks.sort(function (a, b) { return (a?.id ?? 0) - (b?.id ?? 0); });
        }
        /* random: leave as-is from server response */
    }

    function reSortAndRender() {
        applySort();
        renderBooks(filteredBooks);
    }

    function onSortChange(value) {
        currentSort = value || 'id_desc';
        if (currentSort === 'random') {
            loadBooks(currentSort);
        } else {
            reSortAndRender();
        }
    }

    /* ── Fetch ──────────────────────────────── */
    function loadBooks(sort) {
        if (fetchLocked || !gridEl) return;
        fetchLocked = true;
        currentSort = sort || currentSort;

        showSkeletons();

        Auth.fetch('/api/books?limit=100&sort=' + currentSort)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (d) {
                if (d?.code === 0 && d?.data?.length) {
                    allBooks = d.data.slice();
                    filteredBooks = allBooks.slice();
                    filterBooks(currentQuery);
                    scrollToHighlighted();
                } else {
                    showEmpty();
                }
            })
            .catch(function (e) {
                console.error('[BookLibrary] Fetch error:', e);
                showError('Unable to load books. Please try again.');
            })
            .finally(function () {
                fetchLocked = false;
            });
    }

    /* ── Search with debounce ────────────────── */
    function onSearchInput(value) {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            filterBooks(value);
        }, SEARCH_DEBOUNCE);
    }

    function onSearchClear() {
        if (searchEl) searchEl.value = '';
        if (clearEl) clearEl.classList.remove('is-visible');
        filterBooks('');
        if (searchEl) searchEl.focus();
    }

    /* ── Card click delegation ───────────────── */
    var importingId = null;

    function importBookAndRead(bookId) {
        if (importingId === bookId) return;
        importingId = bookId;

        var card = gridEl.querySelector('.classics-card[data-book-id="' + bookId + '"]');
        if (card) card.classList.add('classics-card--loading');

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 120000);

        Auth.fetch('/api/books/' + bookId + '/import', { method: 'POST', signal: controller.signal })
            .then(function (res) {
                clearTimeout(timeoutId);
                if (!res.ok) return res.json().catch(function () { return {}; }).then(function (d) {
                    throw new Error(d.detail || 'Import failed (HTTP ' + res.status + ')');
                });
                return res.json();
            })
            .then(function (d) {
                if (d?.library_id) {
                    window.location.href = 'reader.html?id=' + d.library_id;
                } else {
                    throw new Error('No library_id in response');
                }
            })
            .catch(function (e) {
                clearTimeout(timeoutId);
                console.error('[BookLibrary] Import error:', e);
                var msg = e.name === 'AbortError' ? 'Import timed out. Please try again.' : (e.message || 'Unknown error');
                showToast('Import failed: ' + msg);
                if (card) card.classList.remove('classics-card--loading');
                importingId = null;
            });
    }

    function showToast(msg, type) {
        type = type || 'error';
        var container = document.getElementById('toastContainer');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'toast ' + type;
        var icon = type === 'success'
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        toast.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">' + icon + '<span>' + msg + '</span></div>';
        container.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 4000);
    }

    /* ── Online Search ───────────────────────── */
    var onlineSearchEl, onlineSearchInputEl, onlineSearchResultsEl, onlineSearchHintEl;
    var onlineSearchTimer = null;

    function searchOnline(query) {
        if (!onlineSearchEl || !onlineSearchResultsEl) return;
        var q = (query || '').trim();
        if (!q || q.length < 2) {
            onlineSearchEl.classList.remove('is-active');
            onlineSearchResultsEl.innerHTML = '';
            return;
        }

        onlineSearchEl.classList.add('is-active');
        if (onlineSearchInputEl) onlineSearchInputEl.value = q;
        onlineSearchResultsEl.innerHTML = '<div class="bl-guten-search__status">Searching Gutenberg...</div>';

        Auth.fetch('/api/search/online?q=' + encodeURIComponent(q) + '&page=1')
            .then(function (res) { return res.json(); })
            .then(function (d) {
                if (d?.code !== 0) throw new Error(d?.message || 'Search failed');
                renderOnlineResults(d.data?.results || [], d.data?.count || 0);
            })
            .catch(function (e) {
                console.error('[OnlineSearch] Error:', e);
                onlineSearchResultsEl.innerHTML = '<div class="bl-guten-search__status">Search failed. Please try again.</div>';
            });
    }

    function renderOnlineResults(results, totalCount) {
        if (!onlineSearchResultsEl) return;
        if (!results || !results.length) {
            onlineSearchResultsEl.innerHTML = '<div class="bl-guten-search__status">No results. Try a different query.</div>';
            return;
        }

        var footer = document.getElementById('blGutenSearchFooter');
        if (footer) footer.style.display = 'block';

        var html = '<div class="bl-guten-search__result-grid">';
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            var title = esc(r.title || 'Untitled');
            var author = esc(r.author || 'Unknown');
            var sId = r.source_id;
            var coverUrl = r.cover_url || '';
            var desc = esc((r.description || '').substring(0, 80));
            var btnClass = r.already_imported ? 'is-imported' : '';
            var btnText = r.already_imported ? 'Read Now' : 'Add to Library';
            var downloads = r.download_count ? (r.download_count > 1000 ? Math.round(r.download_count / 1000) + 'k downloads' : r.download_count + ' downloads') : '';

            html += '<div class="bl-guten-result-card">'
                + (coverUrl ? '<img class="bl-guten-result-card__cover" src="' + coverUrl + '" alt="" loading="lazy" />' : '')
                + '<div class="bl-guten-result-card__body">'
                + '<div class="bl-guten-result-card__title">' + title + '</div>'
                + '<div class="bl-guten-result-card__author">' + author + '</div>'
                + (desc ? '<div class="bl-guten-result-card__desc">' + desc + '</div>' : '')
                + (downloads ? '<div class="bl-guten-result-card__meta">' + downloads + '</div>' : '')
                + '<button class="bl-guten-result-card__btn ' + btnClass + '" data-source-id="' + sId + '">' + btnText + '</button>'
                + '</div>'
                + '</div>';
        }
        html += '</div>';
        onlineSearchResultsEl.innerHTML = html;
    }

    function importFromSource(sourceId, btnEl) {
        if (!btnEl) return;
        var originalText = btnEl.textContent;
        btnEl.disabled = true;
        btnEl.textContent = 'Importing...';

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 120000);

        Auth.fetch('/api/books/import-by-source/' + sourceId, { method: 'POST', signal: controller.signal })
            .then(function (res) {
                clearTimeout(timeoutId);
                if (!res.ok) return res.json().catch(function () { return {}; }).then(function (d) {
                    throw new Error(d.detail || 'Import failed');
                });
                return res.json();
            })
            .then(function (d) {
                if (d?.library_id) {
                    window.location.href = 'reader.html?id=' + d.library_id;
                } else {
                    throw new Error('No library_id');
                }
            })
            .catch(function (e) {
                clearTimeout(timeoutId);
                console.error('[OnlineImport] Error:', e);
                var msg = e.name === 'AbortError' ? 'Import timed out. Please try again.' : (e.message || 'Unknown error');
                showToast('Import failed: ' + msg);
                btnEl.disabled = false;
                btnEl.textContent = originalText;
            });
    }

    function bindOnlineSearchEvents() {
        if (!onlineSearchResultsEl) return;
        onlineSearchResultsEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.bl-guten-result-card__btn');
            if (!btn) return;
            var sId = parseInt(btn.getAttribute('data-source-id'), 10);
            if (isNaN(sId)) return;
            importFromSource(sId, btn);
        });

        var chips = document.querySelectorAll('.bl-guten-search__chip');
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var q = this.getAttribute('data-query');
                if (q && onlineSearchInputEl) {
                    onlineSearchInputEl.value = q;
                }
                if (q) searchOnline(q);
            });
        });
    }

    function bindClicks() {
        if (!gridEl) return;
        gridEl.addEventListener('click', function (e) {
            var card = e.target.closest('.classics-card');
            if (!card) return;
            var id = card.getAttribute('data-book-id');
            if (id) importBookAndRead(id);
        });
    }

    /* ── Init ────────────────────────────────── */
    function cacheDom() {
        gridEl   = document.getElementById('blGrid');
        countEl  = document.getElementById('blCount');
        searchEl = document.getElementById('blSearch');
        sortEl   = document.getElementById('blSort');
        clearEl  = document.getElementById('blSearchClear');
        onlineSearchEl = document.getElementById('blGutenSearch');
        onlineSearchInputEl = document.getElementById('blOnlineSearchInput');
        onlineSearchResultsEl = document.getElementById('blOnlineSearchResults');
        onlineSearchHintEl = document.getElementById('blOnlineSearchHint');
    }

    function wireEvents() {
        if (searchEl) {
            searchEl.addEventListener('input', function () {
                var val = this.value;
                if (clearEl) {
                    if (val.length > 0) clearEl.classList.add('is-visible');
                    else clearEl.classList.remove('is-visible');
                }
                onSearchInput(val);
            });
            searchEl.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { this.blur(); return; }
            });
        }

        if (clearEl) {
            clearEl.addEventListener('mousedown', function (e) {
                e.preventDefault();
                onSearchClear();
            });
        }

        if (sortEl) {
            sortEl.addEventListener('change', function () {
                onSortChange(this.value);
            });
        }

        if (onlineSearchInputEl) {
            onlineSearchInputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var q = this.value.trim();
                    if (q && q.length >= 2) searchOnline(q);
                }
            });
            onlineSearchInputEl.addEventListener('input', function () {
                if (onlineSearchTimer) clearTimeout(onlineSearchTimer);
                onlineSearchTimer = setTimeout(function () {
                    var q = onlineSearchInputEl.value.trim();
                    if (q.length >= 2) {
                        searchOnline(q);
                    } else {
                        if (onlineSearchEl) onlineSearchEl.classList.remove('is-active');
                        if (onlineSearchResultsEl) onlineSearchResultsEl.innerHTML = '';
                    }
                }, 500);
            });
        }

        bindOnlineSearchEvents();
    }

    function boot() {
        cacheDom();
        wireEvents();
        bindClicks();

        var params = new URLSearchParams(window.location.search);
        var initQuery = params.get('q');
        if (initQuery && searchEl) {
            searchEl.value = initQuery;
            currentQuery = initQuery;
            if (clearEl) clearEl.classList.add('is-visible');
        }

        loadBooks((sortEl?.value) || 'id_desc');
    }

    function scrollToHighlighted() {
        var params = new URLSearchParams(window.location.search);
        var highlightId = params.get('highlight');
        if (!highlightId || !gridEl) return;
        setTimeout(function () {
            var card = gridEl.querySelector('.classics-card[data-book-id="' + highlightId + '"]');
            if (!card) return;
            card.classList.add('classics-card--highlight');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
