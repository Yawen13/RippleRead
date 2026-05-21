/**
 * news.js — News browsing page
 * Fetches /api/news/library with category filter, renders card grid.
 */
(function () {
    'use strict';

    var ARTICLE_THUMBS = [
        'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=600',
        'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600',
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
        'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600',
        'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600'
    ];

    var currentCategory = 'all';
    var allArticles = [];
    var isFetching = false;

    function esc(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function estimateReadTime(content) {
        if (!content) return 5;
        var words = content.trim().split(/\s+/).length;
        return Math.max(3, Math.ceil(words / 200));
    }

    function getExcerpt(content) {
        if (!content) return '';
        var plain = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (plain.length > 200) {
            plain = plain.substring(0, 200).replace(/\s\S*$/, '') + '...';
        }
        return plain;
    }

    function buildNewsCard(article, idx) {
        var thumb = ARTICLE_THUMBS[idx % ARTICLE_THUMBS.length];
        var source = article.author || article.source || 'News';
        var category = article.category || 'general';
        var title = article.title || 'Untitled';
        var excerpt = getExcerpt(article.content);
        var lexile = (article.lexile_level != null) ? article.lexile_level : 'N/A';
        var readTime = estimateReadTime(article.content);
        var id = article.id || '';

        var html = '<div class="news-card" data-article-id="' + id + '">';

        html += '<div class="news-card__thumb">';
        html += '<img src="' + thumb + '" alt="" loading="lazy"';
        html += ' onerror="var f=document.createElement(\'div\');f.className=\'news-card__thumb-fallback\';';
        html += 'f.innerHTML=\'<span>' + esc(source.charAt(0).toUpperCase()) + '</span>\';';
        html += 'this.parentElement.appendChild(f);this.remove();">';
        html += '<div class="news-card__badges">';
        html += '<span class="news-card__source-badge">' + esc(source) + '</span>';
        html += '<span class="news-card__cat-badge">' + esc(category) + '</span>';
        html += '</div></div>';

        html += '<div class="news-card__body">';
        html += '<h3 class="news-card__title">' + esc(title) + '</h3>';
        if (excerpt) {
            html += '<p class="news-card__excerpt">' + esc(excerpt) + '</p>';
        }
        html += '<div class="news-card__meta">';
        html += '<span class="news-card__read-time">~' + readTime + ' min read</span>';
        html += '<span class="news-card__lexile">' + lexile + 'L</span>';
        html += '</div></div></div>';

        return html;
    }

    function renderArticles(articles) {
        var grid = document.getElementById('newsGrid');
        var empty = document.getElementById('newsEmpty');
        if (!grid) return;

        if (!articles || !articles.length) {
            grid.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            return;
        }

        if (empty) empty.style.display = 'none';
        var html = '';
        for (var i = 0; i < articles.length; i++) {
            html += buildNewsCard(articles[i], i);
        }
        grid.innerHTML = html;
    }

    function showLoading() {
        var loading = document.getElementById('newsLoading');
        var grid = document.getElementById('newsGrid');
        var empty = document.getElementById('newsEmpty');
        if (loading) loading.style.display = 'flex';
        if (grid) grid.innerHTML = '';
        if (empty) empty.style.display = 'none';
    }

    function hideLoading() {
        var loading = document.getElementById('newsLoading');
        if (loading) loading.style.display = 'none';
    }

    function loadNews(category) {
        if (isFetching) return;
        isFetching = true;
        showLoading();

        var url = '/api/news/library';
        if (category && category !== 'all') {
            url += '?category=' + encodeURIComponent(category);
        }

        fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load news');
                return res.json();
            })
            .then(function (data) {
                allArticles = data.news || [];
                renderArticles(allArticles);
            })
            .catch(function (err) {
                console.error('[News] Load error:', err);
                renderArticles([]);
            })
            .finally(function () {
                hideLoading();
                isFetching = false;
            });
    }

    function setActiveCategory(cat) {
        currentCategory = cat;
        var buttons = document.querySelectorAll('.news-cat-btn');
        buttons.forEach(function (btn) {
            var btnCat = btn.getAttribute('data-cat');
            if (btnCat === cat) {
                btn.classList.add('s--active');
            } else {
                btn.classList.remove('s--active');
            }
        });
    }

    function fetchLatestNews() {
        var btn = document.getElementById('newsFetchBtn');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        var origHTML = btn.innerHTML;
        btn.innerHTML = '<span>Fetching...</span>';

        var cat = currentCategory !== 'all' ? currentCategory : 'general';
        Auth.fetch('/api/fetch-news?category=' + encodeURIComponent(cat), { method: 'POST' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (typeof showToast === 'function') {
                    showToast('Fetched ' + (data.inserted || 0) + ' articles', 'success');
                }
                loadNews(currentCategory);
            })
            .catch(function () {
                if (typeof showToast === 'function') {
                    showToast('Failed to fetch news', 'error');
                }
            })
            .finally(function () {
                btn.disabled = false;
                btn.innerHTML = origHTML;
            });
    }

    function bindEvents() {
        var catsContainer = document.getElementById('newsCategories');
        if (catsContainer) {
            catsContainer.addEventListener('click', function (e) {
                var btn = e.target.closest('.news-cat-btn');
                if (!btn) return;
                var cat = btn.getAttribute('data-cat');
                if (cat === currentCategory) return;
                setActiveCategory(cat);
                loadNews(cat);
            });
        }

        var fetchBtn = document.getElementById('newsFetchBtn');
        if (fetchBtn) {
            fetchBtn.addEventListener('click', fetchLatestNews);
        }

        document.addEventListener('click', function (e) {
            var card = e.target.closest('.news-card');
            if (!card) return;
            var id = card.getAttribute('data-article-id');
            if (id) {
                window.location.href = 'reader.html?id=' + id;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            loadNews('all');
            bindEvents();
        });
    } else {
        loadNews('all');
        bindEvents();
    }
})();
