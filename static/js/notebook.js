/**
 * RippleRead — Vocabulary Notebook
 *
 * Features:
 *   - Dynamic stats panel that switches with Word/Sentence tabs
 *   - Mastered toggle icon (✓) on every card with real-time API sync
 *   - Real-time stat updates (+1/-1) without page reload
 *   - Debounced search, state-locked detail loading, defensive DOM guards
 */
(function () {
    'use strict';

    /* ================================================================
       DOM References
       ================================================================ */
    var vocabularyGrid = document.getElementById('vocabularyGrid');
    var sentenceGrid = document.getElementById('sentenceGrid');
    var wordEmptyState = document.getElementById('wordEmptyState');
    var sentenceEmptyState = document.getElementById('sentenceEmptyState');
    var wordSection = document.getElementById('wordSection');
    var sentenceSection = document.getElementById('sentenceSection');
    var searchInput = document.getElementById('searchInput');
    var tabWord = document.getElementById('tabWord');
    var tabSentence = document.getElementById('tabSentence');

    var statTotalEl = document.getElementById('statTotal');
    var statTotalLabel = document.getElementById('statTotalLabel');
    var statMasteredEl = document.getElementById('statMastered');
    var statMasteredLabel = document.getElementById('statMasteredLabel');

    /* ================================================================
       State
       ================================================================ */
    var allItems = [];
    var wordStats = { total: 0, mastered: 0 };
    var sentenceStats = { total: 0, mastered: 0 };
    var selectedWordId = null;
    var selectedSentenceId = null;
    var isDetailLoading = false;
    var isSentenceDetailLoading = false;
    var currentTab = 'word';
    var currentSearchQuery = '';
    var searchDebounceTimer = null;
    var togglePending = {};   // lock: prevent concurrent toggle on same item

    /* ================================================================
       Stats Panel — renders based on currentTab
       ================================================================ */
    function renderStatsPanel() {
        if (!statTotalEl || !statMasteredEl || !statTotalLabel || !statMasteredLabel) return;

        var stats = currentTab === 'word' ? wordStats : sentenceStats;
        var label = currentTab === 'word' ? 'Words' : 'Sentences';

        statTotalLabel.textContent = label;
        statMasteredLabel.textContent = 'Mastered';

        if (String(statTotalEl.textContent) !== String(stats.total)) {
            statTotalEl.textContent = stats.total;
            statTotalEl.classList.add('updated');
            setTimeout(function () { statTotalEl && statTotalEl.classList.remove('updated'); }, 400);
        }
        if (String(statMasteredEl.textContent) !== String(stats.mastered)) {
            statMasteredEl.textContent = stats.mastered;
            statMasteredEl.classList.add('updated');
            setTimeout(function () { statMasteredEl && statMasteredEl.classList.remove('updated'); }, 400);
        }
    }

    /* ================================================================
       Tab Switching
       ================================================================ */
    function switchTab(tab) {
        if (currentTab === tab) return;
        currentTab = tab;

        var allBtns = document.querySelectorAll('.tab-btn');
        allBtns.forEach(function (el) {
            el.classList.remove('tab-active', 'border-teal-600', 'text-teal-600');
            el.classList.add('text-gray-500');
        });

        if (tab === 'word') {
            tabWord.classList.add('tab-active', 'border-teal-600', 'text-teal-600');
            tabWord.classList.remove('text-gray-500');
            wordSection && wordSection.classList.remove('hidden');
            sentenceSection && sentenceSection.classList.add('hidden');
        } else {
            tabSentence.classList.add('tab-active', 'border-teal-600', 'text-teal-600');
            tabSentence.classList.remove('text-gray-500');
            wordSection && wordSection.classList.add('hidden');
            sentenceSection && sentenceSection.classList.remove('hidden');
        }

        renderStatsPanel();
        applySearchFilter();
    }

    tabWord && tabWord.addEventListener('click', function () { switchTab('word'); });
    tabSentence && tabSentence.addEventListener('click', function () { switchTab('sentence'); });

    /* ================================================================
       Data Loading
       ================================================================ */
    async function loadVocabulary() {
        try {
            var response = await Auth.fetch('/api/vocabulary');
            var data = await response.json();
            allItems = data.vocabulary || [];

            wordStats = data.word_stats || { total: 0, mastered: 0 };
            sentenceStats = data.sentence_stats || { total: 0, mastered: 0 };

            renderAll(allItems);
            renderStatsPanel();
        } catch (error) {
            console.error('Error loading vocabulary:', error);
            showError('Failed to load vocabulary');
            throw error;
        }
    }

    /* ================================================================
       Render Wrappers
       ================================================================ */
    function renderAll(items) {
        renderWords(items);
        renderSentences(items);
    }

    /* ----------------------------------------------------------------
       Render Word Cards
       ---------------------------------------------------------------- */
    function renderWords(items) {
        if (!vocabularyGrid) return;

        var words = items.filter(function (item) {
            if (item.item_type === 'sentence') return false;
            var text = item.text || '';
            return text.length < 80;
        });

        if (words.length === 0) {
            vocabularyGrid.innerHTML = '';
            wordEmptyState && wordEmptyState.classList.remove('hidden');
            closeWordDetail();
            return;
        }

        wordEmptyState && wordEmptyState.classList.add('hidden');
        var html = '';

        words.forEach(function (item) {
            var isSelected = selectedWordId === item.id;
            var isMastered = item.is_mastered === 1;

            html += '<div class="vocab-card card-word bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow group'
                + (isSelected ? ' selected border-teal-600' : ' border-slate-100')
                + '" data-word-id="' + item.id + '"'
                + ' data-word-text="' + escapeHtml(item.text) + '"'
                + ' data-word-translation="' + escapeHtml(item.translation) + '"'
                + ' data-word-context="' + escapeHtml(item.context || '') + '">';

            /* --- Mastered toggle (always visible) --- */
            html += '<button class="master-toggle' + (isMastered ? ' mastered' : '') + '" data-id="' + item.id + '">';
            html += '<svg class="icon-unchecked" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
            html += '<svg class="icon-checked" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
            html += '</button>';

            /* --- Delete button (hover only) --- */
            html += '<button class="delete-btn" data-id="' + item.id + '">';
            html += '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
            html += '</button>';

            /* --- Content --- */
            html += '<div class="pr-14">';
            html += '<h3 class="font-serif text-lg font-bold text-gray-900 mb-2">' + escapeHtml(item.text) + '</h3>';
            html += '<p class="font-sans text-sm text-gray-600 mb-2">' + escapeHtml(item.translation) + '</p>';
            if (item.context) {
                html += '<p class="font-sans text-xs text-gray-400 line-clamp-2">'
                    + escapeHtml(item.context) + '</p>';
            }
            html += '</div>';

            html += '</div>';
        });

        vocabularyGrid.innerHTML = html;

        // Bind card click → word detail
        vocabularyGrid.querySelectorAll('.vocab-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.master-toggle') || e.target.closest('.delete-btn')) return;
                var wordId = parseInt(this.dataset.wordId, 10);
                var wordText = this.dataset.wordText || '';
                var wordTranslation = this.dataset.wordTranslation || '';
                var wordContext = this.dataset.wordContext || '';
                openWordDetail({ id: wordId, text: wordText, translation: wordTranslation, context: wordContext });
            });
        });

        // Bind master toggle
        vocabularyGrid.querySelectorAll('.master-toggle').forEach(function (btn) {
            btn.addEventListener('click', toggleMastered);
        });

        // Bind delete
        vocabularyGrid.querySelectorAll('.delete-btn').forEach(function (btn) {
            btn.addEventListener('click', handleDelete);
        });
    }

    /* ----------------------------------------------------------------
       Render Sentence Cards
       ---------------------------------------------------------------- */
    function renderSentences(items) {
        if (!sentenceGrid) return;

        var sentences = items.filter(function (item) {
            if (item.item_type === 'sentence') return true;
            var text = item.text || '';
            return text.length >= 80;
        });

        if (sentences.length === 0) {
            sentenceGrid.innerHTML = '';
            sentenceEmptyState && sentenceEmptyState.classList.remove('hidden');
            return;
        }

        sentenceEmptyState && sentenceEmptyState.classList.add('hidden');
        sentenceGrid.className = 'grid grid-cols-1 gap-5';
        var html = '';

        sentences.forEach(function (item) {
            var isSelected = selectedSentenceId === item.id;
            var isMastered = item.is_mastered === 1;

            html += '<div class="sentence-card card-sentence bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow group relative'
                + (isSelected ? ' selected border-teal-600 shadow-md' : ' border-slate-100')
                + '" data-sentence-id="' + item.id + '"'
                + ' data-sentence-text="' + escapeHtml(item.text) + '"'
                + ' data-sentence-translation="' + escapeHtml(item.translation || '') + '"'
                + ' data-sentence-book-title="' + escapeHtml(item.book_title || '') + '"'
                + ' data-sentence-chapter-title="' + escapeHtml(item.chapter_title || '') + '">';

            /* --- Mastered toggle (always visible) --- */
            html += '<button class="master-toggle' + (isMastered ? ' mastered' : '') + '" data-id="' + item.id + '">';
            html += '<svg class="icon-unchecked" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
            html += '<svg class="icon-checked" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
            html += '</button>';

            /* --- Delete button (hover only) --- */
            html += '<button class="delete-btn" data-id="' + item.id + '">';
            html += '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
            html += '</button>';

            /* --- Content --- */
            html += '<div class="pr-14">';
            html += '<p class="font-serif text-base text-gray-800 leading-relaxed mb-3">' + escapeHtml(item.text) + '</p>';
            html += '<p class="font-sans text-sm text-teal-600">' + escapeHtml(item.translation) + '</p>';
            if (item.context) {
                html += '<p class="font-sans text-xs text-gray-400 mt-2">Context: ' + escapeHtml(item.context) + '</p>';
            }
            html += '</div>';

            html += '</div>';
        });

        sentenceGrid.innerHTML = html;

        // Bind card click → sentence detail
        sentenceGrid.querySelectorAll('.sentence-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.master-toggle') || e.target.closest('.delete-btn')) return;
                var id = parseInt(this.dataset.sentenceId, 10);
                var text = this.dataset.sentenceText || '';
                var translation = this.dataset.sentenceTranslation || '';
                var bookTitle = this.dataset.sentenceBookTitle || '';
                var chapterTitle = this.dataset.sentenceChapterTitle || '';
                openSentenceDetail({ id: id, text: text, translation: translation, book_title: bookTitle, chapter_title: chapterTitle });
            });
        });

        // Bind master toggle
        sentenceGrid.querySelectorAll('.master-toggle').forEach(function (btn) {
            btn.addEventListener('click', toggleMastered);
        });

        // Bind delete
        sentenceGrid.querySelectorAll('.delete-btn').forEach(function (btn) {
            btn.addEventListener('click', handleDelete);
        });
    }

    /* ================================================================
       Mastered Toggle — API call + real-time UI update
       ================================================================ */
    async function toggleMastered(e) {
        e.stopPropagation();
        e.preventDefault();

        var btn = e.currentTarget;
        var id = parseInt(btn.dataset.id, 10);

        // State lock: prevent concurrent toggle on same item
        if (togglePending[id]) return;
        togglePending[id] = true;

        try {
            var response = await Auth.fetch('/api/vocabulary/' + id + '/toggle-mastered', { method: 'PUT' });
            if (!response.ok) throw new Error('Server error');

            var updated = await response.json();
            var newMastered = updated.is_mastered === 1;

            // 1) Update in-memory item
            var item = allItems.find(function (w) { return w.id === id; });
            if (item) {
                item.is_mastered = updated.is_mastered;
            }

            // 2) Update the correct stats bucket
            var itemType = (updated.item_type || (item ? item.item_type : 'word'));
            if (itemType === 'sentence') {
                if (newMastered) {
                    sentenceStats.mastered += 1;
                } else {
                    sentenceStats.mastered = Math.max(0, sentenceStats.mastered - 1);
                }
            } else {
                if (newMastered) {
                    wordStats.mastered += 1;
                } else {
                    wordStats.mastered = Math.max(0, wordStats.mastered - 1);
                }
            }

            // 3) Toggle CSS class on the icon button + pop animation
            btn.classList.toggle('mastered', newMastered);
            btn.classList.add('pop');
            setTimeout(function () { btn.classList.remove('pop'); }, 400);

            // 4) Update stats panel in real time
            renderStatsPanel();

            // 5) Toast feedback
            showToast(newMastered ? 'Marked as mastered' : 'Mastered removed');

        } catch (error) {
            console.error('Error toggling master status:', error);
            showToast('Failed to update', 'error');
        } finally {
            delete togglePending[id];
        }
    }

    /* ================================================================
       Delete Item — API call + stats update
       ================================================================ */
    async function handleDelete(e) {
        e.stopPropagation();
        e.preventDefault();

        var id = parseInt(e.currentTarget.dataset.id, 10);
        if (!id) return;

        var item = allItems.find(function (w) { return w.id === id; });
        var itemType = item ? (item.item_type || 'word') : 'word';
        var wasMastered = item ? (item.is_mastered === 1) : false;

        try {
            var response = await Auth.fetch('/api/vocabulary/' + id, { method: 'DELETE' });
            if (response.ok) {
                allItems = allItems.filter(function (w) { return w.id !== id; });

                if (selectedWordId === id) closeWordDetail();
                if (selectedSentenceId === id) closeSentenceDetail();

                // Update stats
                if (itemType === 'sentence') {
                    sentenceStats.total = Math.max(0, sentenceStats.total - 1);
                    if (wasMastered) sentenceStats.mastered = Math.max(0, sentenceStats.mastered - 1);
                } else {
                    wordStats.total = Math.max(0, wordStats.total - 1);
                    if (wasMastered) wordStats.mastered = Math.max(0, wordStats.mastered - 1);
                }

                renderAll(allItems);
                renderStatsPanel();
                showToast('Item removed');
            }
        } catch (error) {
            console.error('Error deleting:', error);
            showToast('Failed to remove', 'error');
        }
    }

    /* ================================================================
       Utility
       ================================================================ */
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showToast(message, type) {
        type = type || 'success';
        var toast = document.createElement('div');
        toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full shadow-lg text-sm font-sans backdrop-blur-sm transition-all duration-300 '
            + (type === 'success' ? 'bg-gray-900/90 text-white' : 'bg-red-500 text-white');
        toast.textContent = message;
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -10px)';
        document.body.appendChild(toast);
        requestAnimationFrame(function () {
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, 0)';
        });
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -10px)';
            setTimeout(function () { document.body.removeChild(toast); }, 300);
        }, 2000);
    }

    function showError(message) {
        if (vocabularyGrid) {
            vocabularyGrid.innerHTML = '<div class="col-span-full text-center py-20">'
                + '<svg class="w-16 h-16 text-red-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">'
                + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
                + '</svg><p class="font-sans text-gray-500 mt-4">' + message + '</p></div>';
        }
    }

    /* ================================================================
       Search — with debounce
       ================================================================ */
    function applySearchFilter() {
        if (!currentSearchQuery.trim()) {
            renderAll(allItems);
            return;
        }
        var q = currentSearchQuery.toLowerCase();
        var filtered = allItems.filter(function (item) {
            return (item.text && item.text.toLowerCase().indexOf(q) !== -1)
                || (item.translation && item.translation.toLowerCase().indexOf(q) !== -1);
        });
        if (currentTab === 'word') {
            renderWords(filtered);
            renderSentences([]);
        } else {
            renderWords([]);
            renderSentences(filtered);
        }
    }

    function searchVocabulary(query) {
        currentSearchQuery = query;
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function () {
            applySearchFilter();
        }, 200);
    }

    /* ================================================================
       Word Detail
       ================================================================ */
    function getDetailEl(id) { return document.getElementById(id); }

    function openWordDetail(item) {
        if (isDetailLoading) return;
        if (!item || !item.text) return;

        if (selectedWordId === item.id) {
            closeWordDetail();
            return;
        }
        if (selectedSentenceId) closeSentenceDetail();

        selectedWordId = item.id;
        isDetailLoading = true;

        var panel = getDetailEl('wordDetailPanel');
        var loading = getDetailEl('detailLoading');
        var error = getDetailEl('detailError');
        var content = getDetailEl('detailContent');

        if (error) error.classList.add('hidden');
        if (content) content.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');
        if (panel) panel.classList.add('open');

        renderAll(allItems);

        if (panel) {
            setTimeout(function () {
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }

        fetchMindmap(item)
            .then(function (mindmapData) {
                isDetailLoading = false;
                if (loading) loading.classList.add('hidden');
                if (error) error.classList.add('hidden');
                renderDetailContent(item, mindmapData);
                if (content) content.classList.remove('hidden');
            })
            .catch(function (err) {
                isDetailLoading = false;
                if (loading) loading.classList.add('hidden');
                if (content) content.classList.add('hidden');
                var errMsg = getDetailEl('detailErrorMsg');
                if (errMsg) errMsg.textContent = err.message || 'Failed to load word analysis';
                if (error) error.classList.remove('hidden');
            });
    }

    function closeWordDetail() {
        if (selectedWordId === null && !isDetailLoading) return;
        selectedWordId = null;
        isDetailLoading = false;
        var panel = getDetailEl('wordDetailPanel');
        var loading = getDetailEl('detailLoading');
        var error = getDetailEl('detailError');
        var content = getDetailEl('detailContent');
        if (panel) panel.classList.remove('open');
        if (loading) loading.classList.remove('hidden');
        if (error) error.classList.add('hidden');
        if (content) content.classList.add('hidden');
        renderAll(allItems);
    }

    /* ----------------------------------------------------------------
       Bind the close & dismiss buttons (since no inline onclick)
       ---------------------------------------------------------------- */
    var closeDetailBtn = getDetailEl('closeDetailBtn');
    if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeWordDetail);
    var detailDismissBtn = getDetailEl('detailDismissBtn');
    if (detailDismissBtn) detailDismissBtn.addEventListener('click', closeWordDetail);

    /* ================================================================
       Sentence Detail
       ================================================================ */
    function sGetEl(id) { return document.getElementById(id); }

    function openSentenceDetail(item) {
        if (isSentenceDetailLoading) return;
        if (!item || !item.text) return;

        if (selectedSentenceId === item.id) {
            closeSentenceDetail();
            return;
        }
        if (selectedWordId) closeWordDetail();

        selectedSentenceId = item.id;
        isSentenceDetailLoading = true;

        var panel = sGetEl('sentenceDetailPanel');
        var loading = sGetEl('sentenceDetailLoading');
        var error = sGetEl('sentenceDetailError');
        var content = sGetEl('sentenceDetailContent');

        if (error) error.classList.add('hidden');
        if (content) content.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');
        if (panel) panel.classList.add('open');

        renderAll(allItems);

        if (panel) {
            setTimeout(function () {
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }

        fetchSentenceAnalysisAPI(item.text)
            .then(function (analysisData) {
                isSentenceDetailLoading = false;
                if (loading) loading.classList.add('hidden');
                if (error) error.classList.add('hidden');
                renderSentenceDetailContent(item, analysisData);
                if (content) content.classList.remove('hidden');
            })
            .catch(function (err) {
                isSentenceDetailLoading = false;
                if (loading) loading.classList.add('hidden');
                if (content) content.classList.add('hidden');
                var errMsg = sGetEl('sentenceDetailErrorMsg');
                if (errMsg) errMsg.textContent = err.message || 'Failed to analyze sentence';
                if (error) error.classList.remove('hidden');
            });
    }

    function closeSentenceDetail() {
        if (selectedSentenceId === null && !isSentenceDetailLoading) return;
        selectedSentenceId = null;
        isSentenceDetailLoading = false;
        var panel = sGetEl('sentenceDetailPanel');
        var loading = sGetEl('sentenceDetailLoading');
        var error = sGetEl('sentenceDetailError');
        var content = sGetEl('sentenceDetailContent');
        if (panel) panel.classList.remove('open');
        if (loading) loading.classList.remove('hidden');
        if (error) error.classList.add('hidden');
        if (content) content.classList.add('hidden');
        renderAll(allItems);
    }

    /* Bind close buttons */
    var closeSentenceDetailBtn = sGetEl('closeSentenceDetailBtn');
    if (closeSentenceDetailBtn) closeSentenceDetailBtn.addEventListener('click', closeSentenceDetail);
    var sentenceDetailDismissBtn = sGetEl('sentenceDetailDismissBtn');
    if (sentenceDetailDismissBtn) sentenceDetailDismissBtn.addEventListener('click', closeSentenceDetail);

    /* ---------------------------------------------------------------- */
    async function fetchSentenceAnalysisAPI(sentence) {
        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); }, 15000);
        try {
            var response = await Auth.fetch('/api/analyze-sentence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sentence: sentence }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!response.ok) throw new Error('Server error (HTTP ' + response.status + ')');
            var data = await response.json();
            if (!data) throw new Error('No data received from server');
            return data;
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
            throw err;
        }
    }

    function renderSentenceDetailContent(item, data) {
        var originalEl = sGetEl('sentenceDetailOriginal');
        var transEl = sGetEl('sentenceDetailTranslation');
        var grammar = data.grammar_breakdown || {};
        if (originalEl) originalEl.textContent = item.text;
        if (transEl) transEl.textContent = data.translation || 'N/A';

        var subjEl = sGetEl('sdGrammarSubject');
        var verbEl = sGetEl('sdGrammarVerb');
        var objEl = sGetEl('sdGrammarObject');
        var tenseEl = sGetEl('sdGrammarTense');
        if (subjEl) subjEl.textContent = grammar.subject || '';
        if (verbEl) verbEl.textContent = grammar.verb || '';
        if (objEl) objEl.textContent = grammar.object || '';
        if (tenseEl) tenseEl.textContent = grammar.tense_and_clause || '';

        var kpCard = sGetEl('sdKeyPhrasesCard');
        var kpList = sGetEl('sdKeyPhrasesList');
        if (kpList) kpList.innerHTML = '';
        if (data.key_phrases && data.key_phrases.length > 0) {
            data.key_phrases.forEach(function (kp) {
                var row = document.createElement('div');
                row.className = 'flex flex-col gap-0.5';
                var tag = document.createElement('span');
                tag.className = 'inline-block bg-slate-50 text-slate-700 rounded-full px-3 py-1 text-sm border border-slate-100 w-fit font-sans';
                tag.textContent = kp.phrase || '';
                var meaning = document.createElement('span');
                meaning.className = 'text-xs text-slate-400 font-sans pl-1';
                meaning.textContent = kp.meaning || '';
                row.appendChild(tag);
                row.appendChild(meaning);
                if (kpList) kpList.appendChild(row);
            });
            if (kpCard) kpCard.classList.remove('hidden');
        } else {
            if (kpCard) kpCard.classList.add('hidden');
        }

        var tipCard = sGetEl('sdAiTipCard');
        var tipText = sGetEl('sdAiTipText');
        if (tipText) tipText.textContent = data.ai_tip || '';
        if (tipCard) {
            if (data.ai_tip && data.ai_tip.trim()) {
                tipCard.classList.remove('hidden');
            } else {
                tipCard.classList.add('hidden');
            }
        }

        var bookTitleEl = sGetEl('sdBookTitle');
        var chapterEl = sGetEl('sdChapter');
        if (bookTitleEl) bookTitleEl.textContent = item.book_title ? '\u300A' + item.book_title + '\u300B' : '';
        if (chapterEl) chapterEl.textContent = item.chapter_title ? ' \u00B7 ' + item.chapter_title : '';
    }

    /* ================================================================
       Mindmap
       ================================================================ */
    async function fetchMindmap(item) {
        var response = await Auth.fetch('/api/mindmap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: item.text })
        });
        if (!response.ok) throw new Error('AI service unavailable');
        var data = await response.json();
        if (data._error) throw new Error(data._error);
        return data;
    }

    function renderDetailContent(item, data) {
        var wordEl = getDetailEl('detailWord');
        var phoneticEl = getDetailEl('detailPhonetic');
        var posEl = getDetailEl('detailPos');
        var contextEl = getDetailEl('detailContext');
        var contextSection = getDetailEl('detailContextSection');
        var bookTitleEl = getDetailEl('detailBookTitle');
        var chapterEl = getDetailEl('detailChapter');
        var etymologyEl = getDetailEl('detailEtymology');
        var etymologySection = getDetailEl('detailEtymologySection');
        var synonymsEl = getDetailEl('detailSynonyms');
        var synonymsSection = getDetailEl('detailSynonymsSection');
        var antonymsEl = getDetailEl('detailAntonyms');
        var antonymsSection = getDetailEl('detailAntonymsSection');
        var collocationsEl = getDetailEl('detailCollocations');
        var collocationsSection = getDetailEl('detailCollocationsSection');
        var examplesEl = getDetailEl('detailExamples');
        var examplesSection = getDetailEl('detailExamplesSection');

        if (wordEl) wordEl.textContent = data.word || item.text;
        if (phoneticEl) phoneticEl.textContent = data.pronunciation || '';
        if (posEl) posEl.textContent = data.pos || '';

        if (contextEl && item.context) {
            contextEl.textContent = item.context;
            if (contextSection) contextSection.classList.remove('hidden');
        } else if (contextSection) {
            contextSection.classList.add('hidden');
        }

        if (bookTitleEl) bookTitleEl.textContent = item.book_title ? '\u300A' + item.book_title + '\u300B' : '';
        if (chapterEl) chapterEl.textContent = item.chapter_title ? ' \u00B7 ' + item.chapter_title : '';

        if (etymologyEl && data.etymology) {
            etymologyEl.textContent = data.etymology;
            if (etymologySection) etymologySection.classList.remove('hidden');
        } else if (etymologySection) {
            etymologySection.classList.add('hidden');
        }

        if (synonymsEl && data.synonyms && data.synonyms.length > 0) {
            synonymsEl.innerHTML = '';
            data.synonyms.forEach(function (s) {
                var span = document.createElement('span');
                span.className = 'mindmap-tag synonym';
                span.textContent = s;
                synonymsEl.appendChild(span);
            });
            if (synonymsSection) synonymsSection.classList.remove('hidden');
        } else if (synonymsSection) {
            synonymsSection.classList.add('hidden');
        }

        if (antonymsEl && data.antonyms && data.antonyms.length > 0) {
            antonymsEl.innerHTML = '';
            data.antonyms.forEach(function (a) {
                var span = document.createElement('span');
                span.className = 'mindmap-tag antonym';
                span.textContent = a;
                antonymsEl.appendChild(span);
            });
            if (antonymsSection) antonymsSection.classList.remove('hidden');
        } else if (antonymsSection) {
            antonymsSection.classList.add('hidden');
        }

        if (collocationsEl && data.collocations && data.collocations.length > 0) {
            collocationsEl.innerHTML = '';
            data.collocations.forEach(function (c) {
                var span = document.createElement('span');
                span.className = 'mindmap-tag collocation';
                span.textContent = c;
                collocationsEl.appendChild(span);
            });
            if (collocationsSection) collocationsSection.classList.remove('hidden');
        } else if (collocationsSection) {
            collocationsSection.classList.add('hidden');
        }

        if (examplesEl && data.examples && data.examples.length > 0) {
            examplesEl.innerHTML = '';
            data.examples.forEach(function (ex, i) {
                var div = document.createElement('div');
                div.className = 'flex items-start gap-2.5';
                var num = document.createElement('span');
                num.className = 'w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs font-sans font-medium flex items-center justify-center flex-shrink-0 mt-0.5';
                num.textContent = i + 1;
                var p = document.createElement('p');
                p.className = 'font-serif text-sm text-gray-700 leading-relaxed';
                p.textContent = ex;
                div.appendChild(num);
                div.appendChild(p);
                examplesEl.appendChild(div);
            });
            if (examplesSection) examplesSection.classList.remove('hidden');
        } else if (examplesSection) {
            examplesSection.classList.add('hidden');
        }
    }

    /* ================================================================
       Highlight & Query Param Support
       ================================================================ */
    function scrollToHighlightedVocab() {
        var params = new URLSearchParams(window.location.search);
        var highlightId = params.get('highlight');
        if (!highlightId) return;
        setTimeout(function () {
            var card = document.querySelector('[data-word-id="' + highlightId + '"]') || document.querySelector('[data-sentence-id="' + highlightId + '"]');
            if (!card) return;
            card.classList.add('vocab-card--highlight');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    }

    /* ================================================================
       Init — DOMContentLoaded
       ================================================================ */
    document.addEventListener('DOMContentLoaded', function () {
        var params = new URLSearchParams(window.location.search);
        var initTab = params.get('tab');
        var highlightId = params.get('highlight');

        var initPromise = loadVocabulary();

        if (initTab === 'review') {
            initPromise.then(function () {
                switchTab('review');
                setTimeout(function () { scrollToHighlightedVocab(); }, 100);
            });
        } else {
            initPromise.then(function () {
                scrollToHighlightedVocab();
            });
        }

        var initQuery = params.get('q');
        if (initQuery && searchInput) {
            searchInput.value = initQuery;
            searchVocabulary(initQuery);
        }
        if (searchInput) {
            searchInput.addEventListener('input', function (e) { searchVocabulary(e.target.value); });
        }
    });

    /* ================================================================
       Review Mode — SRS Flashcard Logic
       ================================================================ */
    var reviewState = {
        dueItems: [],
        currentIndex: 0,
        totalReviewed: 0,
        isRevealed: false,
        isSubmitting: false
    };

    function rGetEl(id) { return document.getElementById(id); }

    /* Review tab element */
    var tabReview = rGetEl('tabReview');
    var reviewSection = rGetEl('reviewSection');
    var reviewBadge = rGetEl('tabReviewBadge');

    /* ================================================================
       Tab Switching — extended to include Review
       ================================================================ */
    var originalSwitchTab = switchTab;
    switchTab = function (tab) {
        if (currentTab === tab) return;
        currentTab = tab;

        var allBtns = document.querySelectorAll('.tab-btn');
        allBtns.forEach(function (el) {
            el.classList.remove('tab-active', 'border-teal-600', 'text-teal-600');
            el.classList.add('text-gray-500');
        });

        if (tab === 'review') {
            tabReview.classList.add('tab-active', 'border-teal-600', 'text-teal-600');
            tabReview.classList.remove('text-gray-500');
            wordSection && wordSection.classList.add('hidden');
            sentenceSection && sentenceSection.classList.add('hidden');
            reviewSection && reviewSection.classList.remove('hidden');
            loadReviewSession();
        } else if (tab === 'word') {
            tabWord.classList.add('tab-active', 'border-teal-600', 'text-teal-600');
            tabWord.classList.remove('text-gray-500');
            wordSection && wordSection.classList.remove('hidden');
            sentenceSection && sentenceSection.classList.add('hidden');
            reviewSection && reviewSection.classList.add('hidden');
            renderStatsPanel();
            applySearchFilter();
        } else {
            tabSentence.classList.add('tab-active', 'border-teal-600', 'text-teal-600');
            tabSentence.classList.remove('text-gray-500');
            wordSection && wordSection.classList.add('hidden');
            sentenceSection && sentenceSection.classList.remove('hidden');
            reviewSection && reviewSection.classList.add('hidden');
            renderStatsPanel();
            applySearchFilter();
        }
    };

    tabReview && tabReview.addEventListener('click', function () { switchTab('review'); });

    /* ================================================================
       Load Due Words
       ================================================================ */
    async function loadReviewSession() {
        try {
            var resp = await Auth.fetch('/api/vocabulary/review/due?limit=50');
            var data = await resp.json();
            reviewState.dueItems = data.due_items || [];
            reviewState.currentIndex = 0;
            reviewState.totalReviewed = 0;
            reviewState.isRevealed = false;

            updateReviewStatsBadge();
            renderReviewStats();

            if (reviewState.dueItems.length === 0) {
                showReviewEmpty();
            } else {
                showReviewCard();
            }

            fetchReviewStats();
        } catch (e) {
            console.error('Error loading review session:', e);
        }
    }

    async function fetchReviewStats() {
        try {
            var resp = await Auth.fetch('/api/vocabulary/review/stats');
            var data = await resp.json();
            var dueEl = rGetEl('reviewStatDue');
            var newEl = rGetEl('reviewStatNew');
            var learningEl = rGetEl('reviewStatLearning');
            var matureEl = rGetEl('reviewStatMature');
            if (dueEl) dueEl.textContent = data.due || 0;
            if (newEl) newEl.textContent = (data.total_words || 0) - ((data.learning || 0) + (data.mature || 0));
            if (learningEl) learningEl.textContent = data.learning || 0;
            if (matureEl) matureEl.textContent = data.mature || 0;
        } catch (e) {
            console.error('Error fetching review stats:', e);
        }
    }

    function updateReviewStatsBadge() {
        if (!reviewBadge) return;
        var due = reviewState.dueItems.length;
        reviewBadge.textContent = due;
        if (due > 0) {
            reviewBadge.classList.remove('hidden');
        } else {
            reviewBadge.classList.add('hidden');
        }
    }

    function renderReviewStats() {
        var resp = { due: 0, learning: 0, mature: 0, total_words: 0 };
        Auth.fetch('/api/vocabulary/review/stats').then(function (r) { return r.json(); }).then(function (data) {
            resp = data;
            var dueEl = rGetEl('reviewStatDue');
            var newEl = rGetEl('reviewStatNew');
            var learningEl = rGetEl('reviewStatLearning');
            var matureEl = rGetEl('reviewStatMature');
            if (dueEl) dueEl.textContent = data.due || 0;
            if (newEl) newEl.textContent = (data.total_words || 0) - ((data.learning || 0) + (data.mature || 0));
            if (learningEl) learningEl.textContent = data.learning || 0;
            if (matureEl) matureEl.textContent = data.mature || 0;
        }).catch(function () {});
    }

    /* ================================================================
       Show / Hide Review States
       ================================================================ */
    function showReviewEmpty() {
        var cardArea = rGetEl('reviewCardArea');
        var empty = rGetEl('reviewEmptyState');
        var complete = rGetEl('reviewCompleteState');
        var progress = rGetEl('reviewProgressBar');
        if (cardArea) cardArea.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        if (complete) complete.classList.add('hidden');
        if (progress) progress.classList.add('hidden');
    }

    function showReviewComplete() {
        var cardArea = rGetEl('reviewCardArea');
        var empty = rGetEl('reviewEmptyState');
        var complete = rGetEl('reviewCompleteState');
        var progress = rGetEl('reviewProgressBar');
        if (cardArea) cardArea.classList.add('hidden');
        if (empty) empty.classList.add('hidden');
        if (complete) complete.classList.remove('hidden');
        if (progress) progress.classList.add('hidden');

        var totalEl = rGetEl('reviewProgressTotal');
        var completeTotal = reviewState.totalReviewed;
        if (totalEl && completeTotal > 0) {
            totalEl.textContent = completeTotal;
        }
        var currentEl = rGetEl('reviewProgressCurrent');
        if (currentEl) currentEl.textContent = completeTotal;
        var fill = rGetEl('reviewProgressFill');
        if (fill) fill.style.width = '100%';

        updateReviewStatsBadge();
        renderReviewStats();
    }

    function showReviewCard() {
        var cardArea = rGetEl('reviewCardArea');
        var empty = rGetEl('reviewEmptyState');
        var complete = rGetEl('reviewCompleteState');
        var progress = rGetEl('reviewProgressBar');
        var card = rGetEl('reviewFlashcard');
        var ratingBtns = rGetEl('reviewRatingButtons');
        var wordContext = rGetEl('reviewWordContext');

        if (cardArea) cardArea.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
        if (complete) complete.classList.add('hidden');
        if (progress) progress.classList.remove('hidden');

        var total = reviewState.dueItems.length;
        var totalEl = rGetEl('reviewProgressTotal');
        if (totalEl) totalEl.textContent = total;
        updateProgressBar();

        var item = reviewState.dueItems[reviewState.currentIndex];
        var wordTextEl = rGetEl('reviewWordText');
        var transEl = rGetEl('reviewWordTranslation');
        var contextTextEl = rGetEl('reviewWordContextText');
        var contextDiv = rGetEl('reviewWordContext');

        if (wordTextEl) wordTextEl.textContent = item.text || '';
        if (transEl) transEl.textContent = item.translation || '';
        if (contextTextEl && item.context) {
            contextTextEl.textContent = item.context;
            if (contextDiv) contextDiv.classList.remove('hidden');
        } else if (contextDiv) {
            contextDiv.classList.add('hidden');
        }

        // Reset card to front
        reviewState.isRevealed = false;
        if (card) card.classList.remove('revealed');
        if (ratingBtns) ratingBtns.classList.add('hidden');
    }

    function updateProgressBar() {
        var total = reviewState.dueItems.length;
        var currentTotal = reviewState.totalReviewed + 1;
        if (currentTotal > total) return;

        var currentEl = rGetEl('reviewProgressCurrent');
        var fill = rGetEl('reviewProgressFill');
        if (currentEl) currentEl.textContent = currentTotal;
        if (fill) fill.style.width = ((currentTotal / total) * 100) + '%';
    }

    /* ================================================================
       Flashcard Tap to Reveal
       ================================================================ */
    var reviewFlashcard = rGetEl('reviewFlashcard');
    if (reviewFlashcard) {
        reviewFlashcard.addEventListener('click', function () {
            if (reviewState.isRevealed || reviewState.dueItems.length === 0) return;
            reviewState.isRevealed = true;
            reviewFlashcard.classList.add('revealed');
            var ratingBtns = rGetEl('reviewRatingButtons');
            if (ratingBtns) ratingBtns.classList.remove('hidden');
        });
    }

    /* ================================================================
       Rating Buttons
       ================================================================ */
    var ratingButtonsContainer = rGetEl('reviewRatingButtons');
    if (ratingButtonsContainer) {
        ratingButtonsContainer.addEventListener('click', function (e) {
            var btn = e.target.closest('.review-btn');
            if (!btn) return;
            if (reviewState.isSubmitting) return;
            var quality = parseInt(btn.dataset.quality, 10);
            if (!quality) return;
            submitReview(quality);
        });
    }

    async function submitReview(quality) {
        if (reviewState.isSubmitting) return;
        var item = reviewState.dueItems[reviewState.currentIndex];
        if (!item) return;

        reviewState.isSubmitting = true;

        try {
            var resp = await Auth.fetch('/api/vocabulary/review/' + item.id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quality: quality })
            });
            if (!resp.ok) throw new Error('Server error');

            reviewState.totalReviewed++;
            reviewState.currentIndex++;

            if (reviewState.currentIndex >= reviewState.dueItems.length) {
                showReviewComplete();
            } else {
                showReviewCard();
            }
        } catch (err) {
            console.error('Error submitting review:', err);
            showToast('Review failed. Try again.', 'error');
        } finally {
            reviewState.isSubmitting = false;
        }
    }

    /* Dismiss complete state */
    var completeDismissBtn = rGetEl('reviewCompleteDismissBtn');
    if (completeDismissBtn) {
        completeDismissBtn.addEventListener('click', function () {
            switchTab('word');
        });
    }

    /* ================================================================
       Export Dropdown
       ================================================================ */
    var exportBtn = document.getElementById('exportBtn');
    var exportDropdown = document.getElementById('exportDropdown');

    if (exportBtn) {
        exportBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            exportDropdown.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', function () {
        if (exportDropdown) exportDropdown.classList.add('hidden');
    });

    if (exportDropdown) {
        exportDropdown.addEventListener('click', function (e) {
            e.stopPropagation();
            var option = e.target.closest('.export-option');
            if (!option) return;
            var format = option.dataset.format;
            var type = option.dataset.type;
            exportDropdown.classList.add('hidden');
            triggerDownload(format, type);
        });
    }

    async function triggerDownload(format, type) {
        var filename = format === 'anki' ? 'rippleread_anki.csv' : 'rippleread_vocabulary.csv';
        var url = '/api/vocabulary/export?format=' + encodeURIComponent(format) + '&type=' + encodeURIComponent(type);
        try {
            var resp = await fetch(url);
            if (!resp.ok) {
                var err = await resp.json().catch(function () { return {}; });
                throw new Error(err.detail || 'Export failed (HTTP ' + resp.status + ')');
            }
            var blob = await resp.blob();
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 100);
            showToast('Exported successfully');
        } catch (e) {
            console.error('Export error:', e);
            showToast(e.message || 'Export failed', 'error');
        }
    }

})();
