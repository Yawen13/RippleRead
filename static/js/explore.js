/**
 * RippleRead Explore — Glassmorphism + Weaver + Coming Soon
 *
 * Features:
 *   1. AI Word Weaver — SSE streaming story generator
 *   2. Glassmorphism hero with teal glow
 *   3. Capsule input + refined slider
 *   4. Preview + Confirm flow (save to library → reader)
 *   5. Ripple effect on generate button
 */

(function() {
    'use strict';

    var EASE_OUT = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
    var KEYWORD_STORAGE_KEY = 'rippleread_weaver_keywords';

    var currentLexile = 750;
    var weaverStreaming = false;
    var generatedStory = null;
    var paperExpandTimer = null;
    var paperTargetHeight = 0;

    var $ = function(id) { return document.getElementById(id); };
    var lexileSlider = $('lexileSlider');
    var sliderValueDisplay = $('sliderValueDisplay');
    var weaverWords = $('weaverWords');
    var weaverGenerateBtn = $('weaverGenerateBtn');
    var weaverBtnText = $('weaverBtnText');
    var weaverBtnSpinner = $('weaverBtnSpinner');
    var weaverOutput = $('weaverOutput');
    var weaverActions = $('weaverActions');
    var weaverConfirmBtn = $('weaverConfirmBtn');
    var weaverDiscardBtn = $('weaverDiscardBtn');
    var weaverSection = $('weaverSection');
    var lengthPills = $('lengthPills');

    // ── Paper output DOM ──────────────────────────────────
    var paperOutput = null;
    var paperOutputInner = null;

    function ensurePaperOutput() {
        if (paperOutput && paperOutputInner) return;
        if (!weaverSection) return;
        var existing = weaverSection.querySelector('.paper-output');
        if (existing) {
            paperOutput = existing;
            paperOutputInner = existing.querySelector('.paper-output__inner');
            return;
        }
        paperOutput = document.createElement('div');
        paperOutput.className = 'paper-output';
        paperOutput.setAttribute('aria-live', 'polite');
        paperOutput.setAttribute('aria-label', 'Generated story');
        paperOutputInner = document.createElement('div');
        paperOutputInner.className = 'paper-output__inner';
        paperOutput.appendChild(paperOutputInner);
        weaverSection.appendChild(paperOutput);
    }

    // ── Debounce ──────────────────────────────────────────
    function debounce(fn, delay) {
        var timer = null;
        return function() {
            var ctx = this, args = arguments;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
        };
    }

    // ── HTML Escape ───────────────────────────────────────
    function escapeHTML(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ── Auto-resize textarea ──────────────────────────────
    function autoResizeTextarea() {
        if (!weaverWords) return;
        weaverWords.style.height = 'auto';
        weaverWords.style.height = weaverWords.scrollHeight + 'px';
    }

    if (weaverWords) {
        weaverWords.addEventListener('input', debounce(autoResizeTextarea, 16));
    }

    // ============================================================
    //  RIPPLE EFFECT
    // ============================================================

    function spawnRipple(btn, event) {
        if (!btn) return;
        var rect = btn.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height) * 2;
        var x = (event.clientX || (rect.left + rect.width / 2)) - rect.left;
        var y = (event.clientY || (rect.top + rect.height / 2)) - rect.top;
        var ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        btn.appendChild(ripple);
        setTimeout(function() {
            if (ripple && ripple.parentNode) ripple.parentNode.removeChild(ripple);
        }, 700);
    }

    // ============================================================
    //  PAPER PULL-OUT
    // ============================================================

    function resetPaperOutput() {
        ensurePaperOutput();
        if (!paperOutput || !paperOutputInner) return;
        paperOutput.style.transition = 'none';
        paperOutput.style.height = '0px';
        paperOutput.classList.remove('s--active');
        paperOutputInner.innerHTML = '';
        paperOutput.offsetHeight;
        paperOutput.style.transition = 'height 0.45s ' + EASE_OUT + ', opacity 0.35s ' + EASE_OUT;
    }

    function expandPaperToContent() {
        ensurePaperOutput();
        if (!paperOutput || !paperOutputInner) return;
        paperOutput.style.height = 'auto';
        var naturalHeight = paperOutput.scrollHeight;
        paperOutput.style.height = '0px';
        paperOutput.offsetHeight;
        paperTargetHeight = naturalHeight;
        paperOutput.classList.add('s--active');
        requestAnimationFrame(function() {
            if (!paperOutput) return;
            paperOutput.style.height = naturalHeight + 'px';
        });
        if (paperExpandTimer) clearTimeout(paperExpandTimer);
        paperExpandTimer = setTimeout(function() {
            if (!paperOutput) return;
            paperOutput.style.height = 'auto';
        }, 500);
    }

    function adjustPaperHeight() {
        ensurePaperOutput();
        if (!paperOutput || !paperOutputInner) return;
        paperOutput.style.height = 'auto';
        var newHeight = paperOutput.scrollHeight;
        if (Math.abs(newHeight - paperTargetHeight) > 2) {
            paperTargetHeight = newHeight;
            paperOutput.style.height = newHeight + 'px';
        }
    }

    // ============================================================
    //  AI WORD WEAVER — SSE + Preview + Confirm
    // ============================================================

    function updateSliderDisplay() {
        if (!lexileSlider || !sliderValueDisplay) return;
        var val = parseInt(lexileSlider.value, 10);
        sliderValueDisplay.textContent = val + 'L';
        currentLexile = val;
    }

    if (lexileSlider) {
        lexileSlider.addEventListener('input', debounce(updateSliderDisplay, 16));
        updateSliderDisplay();
    }

    function parseWords(rawText) {
        return rawText.split(/[,\uFF0C\s]+/).filter(function(w) { return w.length > 0; });
    }

    // ── Story Length Pills ────────────────────────────
    function getSelectedStoryLength() {
        if (!lengthPills) return 400;
        var active = lengthPills.querySelector('.length-pill.s--active');
        if (!active) return 400;
        return parseInt(active.getAttribute('data-words'), 10) || 400;
    }

    if (lengthPills) {
        lengthPills.addEventListener('click', function(e) {
            var pill = e.target.closest('.length-pill');
            if (!pill) return;
            var pills = lengthPills.querySelectorAll('.length-pill');
            for (var i = 0; i < pills.length; i++) pills[i].classList.remove('s--active');
            pill.classList.add('s--active');
        });
    }

    function handleWeaverGenerate(event) {
        if (weaverStreaming) return;
        if (!weaverWords) return;

        if (event && weaverGenerateBtn) {
            spawnRipple(weaverGenerateBtn, event);
        }

        var rawText = weaverWords.value.trim();
        if (!rawText) {
            showWeaverAlert('Please enter at least one word.');
            return;
        }

        var words = parseWords(rawText);
        if (words.length === 0) {
            showWeaverAlert('Please enter at least one word.');
            return;
        }

        var targetLexile = lexileSlider ? parseInt(lexileSlider.value, 10) : 750;
        var targetWordCount = getSelectedStoryLength();

        setWeaverLoading(true);
        weaverStreaming = true;
        generatedStory = null;
        hideWeaverActions();

        ensurePaperOutput();
        resetPaperOutput();

        if (paperOutputInner) {
            paperOutputInner.innerHTML =
                '<div class="story-english">' +
                    '<span class="story-cursor"></span> Weaving your story\u2026' +
                '</div>';
        }
        expandPaperToContent();

        var accumulatedText = '';

        Auth.fetch('/api/explore/weaver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ words: words, target_lexile: targetLexile, word_count: targetWordCount })
        })
        .then(function(response) {
            if (!response.ok) {
                return response.text().then(function(t) {
                    throw new Error('Server error: ' + response.status);
                });
            }

            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            function processChunk() {
                return reader.read().then(function(result) {
                    if (result.done) {
                        finalizeWeaverStream(accumulatedText);
                        return;
                    }

                    buffer += decoder.decode(result.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (!line || !line.startsWith('data: ')) continue;

                        var dataStr = line.substring(6);
                        if (dataStr === '[DONE]') {
                            finalizeWeaverStream(accumulatedText);
                            setWeaverLoading(false);
                            weaverStreaming = false;
                            return;
                        }

                        try {
                            var evt = JSON.parse(dataStr);
                            if (evt.error) {
                                showWeaverAlert(evt.error);
                                setWeaverLoading(false);
                                weaverStreaming = false;
                                return;
                            }
                            if (evt.chunk) {
                                accumulatedText += evt.chunk;
                                updatePaperStreamDisplay(accumulatedText);
                                adjustPaperHeight();
                            }
                            if (evt.done) {
                                finalizeWeaverStream(evt.english || accumulatedText, evt.chinese || '');
                                setWeaverLoading(false);
                                weaverStreaming = false;
                                return;
                            }
                        } catch(e) {}
                    }

                    return processChunk();
                });
            }

            return processChunk();
        })
        .catch(function(err) {
            console.error('Weaver error:', err);
            showWeaverAlert('Failed to generate. Please try again.');
            setWeaverLoading(false);
            weaverStreaming = false;
        });
    }

    function updatePaperStreamDisplay(text) {
        ensurePaperOutput();
        if (!paperOutputInner) return;
        paperOutputInner.innerHTML =
            '<div class="story-english">' +
                escapeHTML(text) +
                '<span class="story-cursor"></span>' +
            '</div>';
    }

    function finalizeWeaverStream(english, chinese) {
        english = english || '';
        chinese = chinese || '';

        if (!chinese && english.indexOf('|||TRANSLATION|||') !== -1) {
            var parts = english.split('|||TRANSLATION|||');
            english = (parts[0] || '').trim();
            chinese = (parts[1] || '').trim();
        }

        ensurePaperOutput();
        if (!paperOutputInner) return;

        var html = '<div class="story-english">' + escapeHTML(english) + '</div>';
        if (chinese) {
            html += '<div class="story-chinese">' + escapeHTML(chinese) + '</div>';
        }
        paperOutputInner.innerHTML = html;
        expandPaperToContent();

        generatedStory = {
            english: english,
            chinese: chinese,
            title: makeTitleFromStory(english),
            lexile: currentLexile
        };

        showWeaverActions();
    }

    function makeTitleFromStory(english) {
        if (!english) return 'My Woven Story';
        var firstSentence = english.split(/[.!?]\s/)[0];
        if (!firstSentence) return 'My Woven Story';
        firstSentence = firstSentence.replace(/\*\*/g, '').trim();
        if (firstSentence.length > 80) {
            firstSentence = firstSentence.substring(0, 77).replace(/\s+\S*$/, '') + '\u2026';
        }
        return firstSentence;
    }

    // ── Confirm / Discard ────────────────────────────────

    function showWeaverActions() {
        if (weaverActions) weaverActions.style.display = 'flex';
    }

    function hideWeaverActions() {
        if (weaverActions) weaverActions.style.display = 'none';
    }

    function handleConfirmStory() {
        if (!generatedStory) return;
        if (!weaverConfirmBtn) return;
        weaverConfirmBtn.disabled = true;
        weaverConfirmBtn.textContent = 'Saving\u2026';

        Auth.fetch('/api/explore/weaver/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: generatedStory.title,
                content: generatedStory.english,
                lexile_level: generatedStory.lexile
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.code === 200 && data.data && data.data.id) {
                if (weaverWords) {
                    var words = parseWords(weaverWords.value.trim());
                    saveKeywordHistory(words);
                }
                window.location.href = 'reader.html?id=' + data.data.id;
            } else {
                showWeaverAlert('Failed to save: ' + (data.message || 'Unknown error'));
                if (weaverConfirmBtn) {
                    weaverConfirmBtn.disabled = false;
                    weaverConfirmBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Confirm &amp; Read';
                }
            }
        })
        .catch(function(err) {
            console.error('Save error:', err);
            showWeaverAlert('Failed to save. Please try again.');
            if (weaverConfirmBtn) {
                weaverConfirmBtn.disabled = false;
                weaverConfirmBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Confirm &amp; Read';
            }
        });
    }

    function handleDiscardStory() {
        generatedStory = null;
        hideWeaverActions();
        resetPaperOutput();
    }

    // ── Keyword History (localStorage only — no UI chips) ─

    function loadKeywordHistory() {
        try {
            var raw = localStorage.getItem(KEYWORD_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch(e) { return []; }
    }

    function saveKeywordHistory(keywords) {
        if (!keywords || keywords.length === 0) return;
        var history = loadKeywordHistory();
        for (var i = 0; i < keywords.length; i++) {
            var w = keywords[i].toLowerCase().trim();
            if (!w) continue;
            history = history.filter(function(item) { return item.word !== w; });
            history.unshift({ word: w, ts: Date.now() });
        }
        history = history.slice(0, 20);
        try { localStorage.setItem(KEYWORD_STORAGE_KEY, JSON.stringify(history)); } catch(e) {}
    }

    // ── Loading State ────────────────────────────────────

    function setWeaverLoading(isLoading) {
        if (!weaverGenerateBtn) return;
        weaverGenerateBtn.disabled = isLoading;
        if (weaverBtnText) weaverBtnText.style.display = isLoading ? 'none' : 'inline';
        if (weaverBtnSpinner) weaverBtnSpinner.style.display = isLoading ? 'inline' : 'none';
    }

    function showWeaverAlert(message) {
        ensurePaperOutput();
        if (!paperOutput || !paperOutputInner) return;
        hideWeaverActions();
        paperOutputInner.innerHTML =
            '<div style="color:#B91C1C;font-family:Inter,sans-serif;font-size:0.85rem;padding:8px 0;">' +
                escapeHTML(message) +
            '</div>';
        expandPaperToContent();
        setTimeout(function() {
            if (paperOutput && paperOutputInner) {
                var ct = (paperOutputInner.textContent || '').trim();
                if (ct === message) resetPaperOutput();
            }
        }, 5000);
    }

    // ============================================================
    //  EVENT BINDINGS
    // ============================================================

    if (weaverGenerateBtn) {
        weaverGenerateBtn.addEventListener('click', handleWeaverGenerate);
    }

    if (weaverConfirmBtn) {
        weaverConfirmBtn.addEventListener('click', handleConfirmStory);
    }

    if (weaverDiscardBtn) {
        weaverDiscardBtn.addEventListener('click', handleDiscardStory);
    }

    // ============================================================
    //  INIT
    // ============================================================

    function init() {
        ensurePaperOutput();
        autoResizeTextarea();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
