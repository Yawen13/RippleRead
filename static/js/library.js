/**
 * RippleRead Library — State, Rendering & Interactions
 * Premium Morandi card system with debounced search
 */
(function () {
    'use strict';

    var currentFilter = 'all';
    var allLibraryItems = [];
    var searchTerm = '';
    var searchDebounceTimer = null;
    var isDeleting = false;

    /* ── Morandi Cover Palette ─────────────────── */
    var COVER_PALETTE = [
        'cover--parchment',
        'cover--forest',
        'cover--slate',
        'cover--warm-brown',
        'cover--blue-gray',
        'cover--taupe',
        'cover--dusty-rose',
        'cover--moss',
        'cover--charcoal',
        'cover--cream'
    ];

    function getCoverClass(index) {
        return COVER_PALETTE[(index ?? 0) % COVER_PALETTE.length];
    }

    /* ── DOM References ─────────────────────────── */
    var $grid = document.getElementById('libraryGrid');
    var $empty = document.getElementById('libraryEmpty');
    var $search = document.getElementById('librarySearch');
    var $tabs = document.getElementById('libraryTabs');
    var $importBtn = document.getElementById('importEbookBtn');
    var $fileInput = document.getElementById('ebookFileInput');
    var $importStatus = document.getElementById('importStatus');
    var $toastContainer = document.getElementById('toastContainer');

    /* ── Toast ──────────────────────────────────── */
    function showToast(message, type) {
        type = type ?? 'success';
        if (!$toastContainer) return;

        var toast = document.createElement('div');
        toast.className = 'toast ' + type;

        var icon = type === 'success'
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

        toast.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">' + icon + '<span>' + message + '</span></div>';
        $toastContainer.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    }

    /* ── Data Loading ────────────────────────────── */
    function loadLibraryItems() {
        Auth.fetch('/api/library')
            .then(function (res) { return res.json(); })
            .then(function (items) {
                allLibraryItems = Array.isArray(items) ? items : [];
                renderLibrary();
            })
            .catch(function (err) {
                console.error('[Library] Load error:', err);
                allLibraryItems = [];
                renderLibrary();
            });
    }

    /* ── Filter & Search ────────────────────────── */
    function getFilteredItems() {
        var items = allLibraryItems;

        if (currentFilter === 'books') {
            items = items.filter(function (item) {
                return (item.source_type ?? '') !== 'news';
            });
        } else if (currentFilter === 'saved') {
            items = items.filter(function (item) {
                return (item.is_saved ?? false);
            });
        }

        if (searchTerm.trim()) {
            var term = searchTerm.trim().toLowerCase();
            items = items.filter(function (item) {
                var title = (item.title ?? '').toLowerCase();
                var author = (item.author ?? '').toLowerCase();
                return title.indexOf(term) !== -1 || author.indexOf(term) !== -1;
            });
        }

        return items;
    }

    function renderLibrary() {
        var items = getFilteredItems();

        if (!$grid || !$empty) return;

        if (items.length === 0) {
            $grid.innerHTML = '';
            $empty.style.display = 'flex';
            return;
        }

        $empty.style.display = 'none';
        $grid.innerHTML = items.map(function (item, idx) {
            return buildCardHTML(item, idx);
        }).join('');

        bindCardEvents();
    }

    /* ── Card HTML Builder ──────────────────────── */
    function buildCardHTML(item, idx) {
        var coverClass = getCoverClass(item.id ?? idx);
        var title = item.title ?? 'Untitled';
        var author = item.author ?? '';
        var progress = item.progress ?? 0;
        var isNews = (item.source_type ?? '') === 'news';
        var sourceTypeLabel = isNews ? 'News' : 'Book';
        var isSaved = item.is_saved ?? false;
        var coverUrl = item.cover_url ?? '';

        var titleShort = title.length > 40 ? title.substring(0, 38) + '...' : title;

        var hasRealCover = coverUrl && coverUrl.indexOf('http') === 0 && coverUrl.indexOf('placehold.co') === -1;

        return ''
            + '<div class="library-card" data-item-id="' + (item.id ?? '') + '" data-source-type="' + (item.source_type ?? '') + '">'
            + '  <div class="library-card__shadow">'
            + '    <button class="library-card__fav' + (isSaved ? ' is-faved' : '') + '" data-fav-id="' + (item.id ?? '') + '" title="' + (isSaved ? 'Remove from favorites' : 'Add to favorites') + '">'
            + '      <svg viewBox="0 0 24 24" fill="' + (isSaved ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
            + '      </svg>'
            + '    </button>'
            + '    <button class="library-card__delete" data-id="' + (item.id ?? '') + '" title="Remove from library">'
            + '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '        <polyline points="3 6 5 6 21 6"/>'
            + '        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>'
            + '        <line x1="10" y1="11" x2="10" y2="17"/>'
            + '        <line x1="14" y1="11" x2="14" y2="17"/>'
            + '      </svg>'
            + '    </button>'
            + '    <div class="library-card__cover ' + coverClass + (hasRealCover ? ' library-card__cover--image' : '') + '">'
            + (hasRealCover
                ? '      <img class="library-card__cover-img" src="' + escapeHTML(coverUrl) + '" alt="' + escapeHTML(title) + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.classList.remove(\'library-card__cover--image\');">'
                : '')
            + '      <div class="library-card__cover-inner">'
            + '        <span class="library-card__title">' + escapeHTML(titleShort) + '</span>'
            + (author ? '        <span class="library-card__author">' + escapeHTML(author) + '</span>' : '')
            + '        <span class="library-card__badge">' + escapeHTML(sourceTypeLabel) + '</span>'
            + '      </div>'
            + '    </div>'
            + '  </div>'
            + '  <div class="library-card__info">'
            + '    <p class="library-card__info-title" title="' + escapeHTML(title) + '">' + escapeHTML(title) + '</p>'
            + (author ? '    <p class="library-card__info-meta">' + escapeHTML(author) + '</p>' : '')
            + (isNews ? '' : buildProgressHTML(progress))
            + '  </div>'
            + '</div>';
    }

    function buildProgressHTML(progress) {
        return ''
            + '<div class="library-card__progress">'
            + '  <div class="library-card__progress-bar">'
            + '    <div class="library-card__progress-fill" style="width:' + (progress ?? 0) + '%"></div>'
            + '  </div>'
            + '  <span class="library-card__progress-text">' + (progress ?? 0) + '%</span>'
            + '</div>';
    }

    function escapeHTML(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /* ── Card Event Binding ─────────────────────── */
    function bindCardEvents() {
        if (!$grid) return;

        var cards = $grid.querySelectorAll('.library-card');
        cards.forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.library-card__delete')) return;
                if (e.target.closest('.library-card__fav')) return;
                var itemId = card.dataset.itemId;
                if (itemId) {
                    window.location.href = 'reader.html?id=' + itemId;
                }
            });
        });

        var deleteBtns = $grid.querySelectorAll('.library-card__delete');
        deleteBtns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var id = parseInt(this.dataset.id, 10);
                if (id && !isNaN(id)) deleteLibraryItem(id);
            });
        });

        var favBtns = $grid.querySelectorAll('.library-card__fav');
        favBtns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var id = parseInt(this.dataset.favId, 10);
                if (id && !isNaN(id)) toggleFavorite(id, this);
            });
        });
    }

    /* ── Toggle Favorite ───────────────────────── */
    function toggleFavorite(itemId, btnEl) {
        // Optimistic UI update
        var svg = btnEl.querySelector('svg');
        var wasFaved = btnEl.classList.contains('is-faved');
        var newFaved = !wasFaved;

        if (newFaved) {
            btnEl.classList.add('is-faved');
            btnEl.title = 'Remove from favorites';
            if (svg) svg.setAttribute('fill', 'currentColor');
        } else {
            btnEl.classList.remove('is-faved');
            btnEl.title = 'Add to favorites';
            if (svg) svg.setAttribute('fill', 'none');
        }
        var item = allLibraryItems.find(function (x) { return x.id === itemId; });
        if (item) item.is_saved = newFaved ? 1 : 0;
        showToast(newFaved ? 'Added to favorites' : 'Removed from favorites');

        Auth.fetch('/api/library/' + itemId + '/favorite', { method: 'PUT' })
            .then(function (res) { return res.json(); })
            .then(function (d) {
                if (d?.code === 0 && d?.data) {
                    var serverFaved = d.data.is_saved;
                    if (serverFaved !== newFaved) {
                        // Sync with server
                        if (serverFaved) {
                            btnEl.classList.add('is-faved');
                            btnEl.title = 'Remove from favorites';
                            if (svg) svg.setAttribute('fill', 'currentColor');
                        } else {
                            btnEl.classList.remove('is-faved');
                            btnEl.title = 'Add to favorites';
                            if (svg) svg.setAttribute('fill', 'none');
                        }
                        if (item) item.is_saved = serverFaved ? 1 : 0;
                    }
                }
            })
            .catch(function (err) {
                console.error('[Library] Favorite toggle error:', err);
                // Revert on failure
                if (newFaved) {
                    btnEl.classList.remove('is-faved');
                    btnEl.title = 'Add to favorites';
                    if (svg) svg.setAttribute('fill', 'none');
                } else {
                    btnEl.classList.add('is-faved');
                    btnEl.title = 'Remove from favorites';
                    if (svg) svg.setAttribute('fill', 'currentColor');
                }
                if (item) item.is_saved = wasFaved ? 1 : 0;
                showToast('Failed to update favorite', 'error');
            });
    }

    /* ── Delete Item ────────────────────────────── */
    function deleteLibraryItem(itemId) {
        if (isDeleting) return;
        if (!confirm('Remove this item from your library?')) return;

        isDeleting = true;

        Auth.fetch('/api/library/' + itemId, { method: 'DELETE' })
            .then(function (res) {
                if (res.ok) {
                    allLibraryItems = allLibraryItems.filter(function (item) {
                        return item.id !== itemId;
                    });
                    renderLibrary();
                    showToast('Item removed from library');
                } else {
                    showToast('Failed to remove item', 'error');
                }
                isDeleting = false;
            })
            .catch(function (err) {
                console.error('[Library] Delete error:', err);
                showToast('Failed to remove item', 'error');
                isDeleting = false;
            });
    }

    /* ── Tab Switching ──────────────────────────── */
    function setupTabs() {
        if (!$tabs) return;

        $tabs.addEventListener('click', function (e) {
            var tab = e.target.closest('.library-tab');
            if (!tab) return;

            var filter = tab.dataset.filter;
            if (!filter || filter === currentFilter) return;

            currentFilter = filter;

            $tabs.querySelectorAll('.library-tab').forEach(function (t) {
                t.classList.remove('s--active');
            });
            tab.classList.add('s--active');

            renderLibrary();
        });
    }

    /* ── Debounced Search ───────────────────────── */
    function setupSearch() {
        if (!$search) return;

        $search.addEventListener('input', function () {
            var value = this.value;

            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

            searchDebounceTimer = setTimeout(function () {
                searchTerm = value;
                renderLibrary();
            }, 250);
        });
    }

    /* ── Ebook Import ───────────────────────────── */
    function setupEbookImport() {
        if (!$importBtn || !$fileInput) return;

        $importBtn.addEventListener('click', function () {
            $fileInput.click();
        });

        $fileInput.addEventListener('change', function () {
            var file = $fileInput.files?.[0];
            if (!file) return;

            var originalHTML = $importBtn.innerHTML;
            $importBtn.disabled = true;
            $importBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Uploading...';

            if ($importStatus) $importStatus.style.display = 'inline';

            var formData = new FormData();
            formData.append('file', file);

            Auth.fetch('/api/upload-book', {
                method: 'POST',
                body: formData
            })
                .then(function (res) {
                    if (!res.ok) {
                        return res.json().catch(function () { return {}; }).then(function (data) {
                            throw new Error(data.detail || 'Upload failed');
                        });
                    }
                    return res.json();
                })
                .then(function () {
                    showToast('Book imported & Lexile analyzed!', 'success');
                    loadLibraryItems();
                })
                .catch(function (err) {
                    console.error('[Library] Upload error:', err);
                    showToast(err.message || 'Failed to import book', 'error');
                })
                .then(function () {
                    $importBtn.disabled = false;
                    $importBtn.innerHTML = originalHTML;
                    if ($importStatus) $importStatus.style.display = 'none';
                    $fileInput.value = '';
                });
        });
    }

    /* ── URL Import ────────────────────────────── */
    function setupUrlImport() {
        var $urlInput = document.getElementById('libraryUrlInput');
        var $urlBtn = document.getElementById('libraryUrlBtn');
        if (!$urlInput || !$urlBtn) return;

        function doImport() {
            var url = $urlInput.value.trim();
            if (!url) return;

            var originalHTML = $urlBtn.innerHTML;
            $urlBtn.disabled = true;
            $urlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Importing...';

            Auth.fetch('/api/import/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, title: '' })
            })
                .then(function (res) {
                    if (!res.ok) return res.json().catch(function () { return {}; }).then(function (d) {
                        throw new Error(d.detail || 'Import failed');
                    });
                    return res.json();
                })
                .then(function (d) {
                    if (d?.library_id) {
                        showToast('Article imported!', 'success');
                        window.location.href = 'reader.html?id=' + d.library_id;
                    } else {
                        throw new Error('No library_id');
                    }
                })
                .catch(function (err) {
                    console.error('[Library] URL import error:', err);
                    showToast(err.message || 'Failed to import URL', 'error');
                    $urlBtn.disabled = false;
                    $urlBtn.innerHTML = originalHTML;
                });
        }

        $urlBtn.addEventListener('click', function () {
            doImport();
        });

        $urlInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                doImport();
            }
        });
    }

    /* ── Init ───────────────────────────────────── */
    function init() {
        var params = new URLSearchParams(window.location.search);
        var initQuery = params.get('q');
        if (initQuery && $search) {
            $search.value = initQuery;
            searchTerm = initQuery;
        }
        loadLibraryItems();
        setupTabs();
        setupSearch();
        setupEbookImport();
        setupUrlImport();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
