var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

var FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];

var currentHeatmapData = [];
var currentMonthOffset = 0;
var visibleMonths = 1;
var isAnimating = false;
var resizeDebounceTimer = null;

function getHeatmapColor(count) {
    if (count === 0) return 'bg-gray-50';
    if (count <= 2) return 'bg-teal-100';
    if (count <= 4) return 'bg-teal-200';
    if (count <= 6) return 'bg-teal-400';
    return 'bg-teal-600';
}

function getMonthData(data, monthOffset) {
    if (!data || !data.length) return { monthData: [], monthLabel: '', startOffset: 0, year: 0, month: 0, daysInMonth: 0 };

    var now = new Date();
    var targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    var year = targetMonth.getFullYear();
    var month = targetMonth.getMonth();

    var monthLabel = FULL_MONTHS[month] + ' ' + year;
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var monthData = data.filter(function(item) {
        var d = new Date(item.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
    });

    var startOffset = 0;
    var firstDayOfMonth = new Date(year, month, 1);
    startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    var fullMonthData = [];
    for (var day = 1; day <= daysInMonth; day++) {
        var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        var existingItem = monthData.find(function(item) { return item.date === dateStr; });
        fullMonthData.push(existingItem || { date: dateStr, count: 0 });
    }

    return { monthData: fullMonthData, monthLabel: monthLabel, startOffset: startOffset, year: year, month: month, daysInMonth: daysInMonth };
}

function updateVisibleMonths() {
    visibleMonths = 5;
    return true;
}

function getCellSize() {
    var width = window.innerWidth;
    if (width >= 768) return 16;
    return 14;
}

function getGapSize() {
    return 2;
}

function renderHeatmap(heatmapData, monthOffset, direction) {
    monthOffset = monthOffset ?? 0;
    direction = direction ?? 'none';

    var gridEl = document.getElementById('heatmap-grid');
    var monthLabelEl = document.getElementById('heatmap-month-label');
    if (!gridEl) return;

    var data = heatmapData && heatmapData.length ? heatmapData : currentHeatmapData;
    if (!data || !data.length) return;

    var cellSize = getCellSize();

    updateVisibleMonths();

    var monthInfos = [];
    for (var i = 0; i < visibleMonths; i++) {
        var info = getMonthData(data, monthOffset + i);
        monthInfos.push(info);
    }

    var startMonthInfo = monthInfos[0];
    var endMonthInfo = monthInfos[monthInfos.length - 1];

    if (monthLabelEl) {
        if (visibleMonths === 1) {
            monthLabelEl.textContent = startMonthInfo.monthLabel;
        } else {
            monthLabelEl.textContent = startMonthInfo.monthLabel + ' - ' + endMonthInfo.monthLabel;
        }
    }

    var leadingOffset = startMonthInfo.startOffset;

    var flatCells = [];
    for (var m = 0; m < monthInfos.length; m++) {
        var mon = monthInfos[m];
        for (var d = 0; d < mon.monthData.length; d++) {
            flatCells.push(mon.monthData[d]);
        }
    }

    var totalCells = leadingOffset + flatCells.length;
    var totalCols = Math.ceil(totalCells / 7);
    var trailing = totalCols * 7 - totalCells;

    var monthColSpans = [];
    for (var k = 0; k < monthInfos.length; k++) {
        var mi = monthInfos[k];
        var firstIdx = 0;
        for (var t0 = 0; t0 < k; t0++) {
            firstIdx += monthInfos[t0].daysInMonth;
        }
        var lastIdx = firstIdx + mi.daysInMonth - 1;
        var globalFirst = leadingOffset + firstIdx;
        var globalLast = leadingOffset + lastIdx;
        var startCol = Math.floor(globalFirst / 7);
        var endCol = Math.floor(globalLast / 7);
        monthColSpans.push({ label: MONTHS[mi.month] + ' ' + mi.year, startCol: startCol, endCol: endCol });
    }

    gridEl.innerHTML = '';

    var gapSize = getGapSize();
    var labelsContainer = document.createElement('div');
    labelsContainer.className = 'heatmap-month-labels';
    labelsContainer.style.width = (totalCols * cellSize + (totalCols - 1) * gapSize) + 'px';

    for (var h = 0; h < monthColSpans.length; h++) {
        var mc = monthColSpans[h];
        var label = document.createElement('span');
        label.className = 'heatmap-month-label';
        label.textContent = mc.label;
        label.style.left = (mc.startCol * (cellSize + gapSize)) + 'px';
        labelsContainer.appendChild(label);
    }
    gridEl.appendChild(labelsContainer);

    var unifiedGrid = document.createElement('div');
    unifiedGrid.className = 'heatmap-unified-grid';
    unifiedGrid.style.gridTemplateColumns = 'repeat(' + totalCols + ', ' + cellSize + 'px)';

    for (var p = 0; p < leadingOffset; p++) {
        var ph = document.createElement('div');
        ph.className = 'heatmap-cell heatmap-placeholder';
        unifiedGrid.appendChild(ph);
    }

    for (var c = 0; c < flatCells.length; c++) {
        var item = flatCells[c];
        var cell = document.createElement('div');
        var count = item.count ?? 0;
        cell.className = 'heatmap-cell ' + getHeatmapColor(count);
        cell.title = item.date + ': ' + count + ' actions';
        unifiedGrid.appendChild(cell);
    }

    for (var t = 0; t < trailing; t++) {
        var tr = document.createElement('div');
        tr.className = 'heatmap-cell heatmap-placeholder';
        unifiedGrid.appendChild(tr);
    }

    gridEl.appendChild(unifiedGrid);

    var hAxis = document.getElementById('heatmap-x-axis');
    if (hAxis) hAxis.innerHTML = '';

    if (direction !== 'none' && !isAnimating) {
        isAnimating = true;
        var animationClass = direction === 'left' ? 'slide-in-from-right' : 'slide-in-from-left';
        unifiedGrid.classList.add(animationClass);

        requestAnimationFrame(function() {
            unifiedGrid.classList.add('slide-active');
        });

        setTimeout(function() {
            unifiedGrid.classList.remove(animationClass, 'slide-active');
            isAnimating = false;
        }, 350);
    }
}

function updateNavButtons() {
    var prevBtn = document.getElementById('heatmap-prev');
    var nextBtn = document.getElementById('heatmap-next');
    if (prevBtn) {
        prevBtn.disabled = currentMonthOffset <= -11;
        prevBtn.style.opacity = currentMonthOffset <= -11 ? '0.3' : '1';
        prevBtn.style.cursor = currentMonthOffset <= -11 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
        nextBtn.disabled = currentMonthOffset >= 0;
        nextBtn.style.opacity = currentMonthOffset >= 0 ? '0.3' : '1';
        nextBtn.style.cursor = currentMonthOffset >= 0 ? 'not-allowed' : 'pointer';
    }
}

function initHeatmapNavigation() {
    var prevBtn = document.getElementById('heatmap-prev');
    var nextBtn = document.getElementById('heatmap-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (isAnimating || currentMonthOffset <= -11) return;
            currentMonthOffset--;
            renderHeatmap(currentHeatmapData, currentMonthOffset, 'right');
            updateNavButtons();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            if (isAnimating || currentMonthOffset >= 0) return;
            currentMonthOffset++;
            renderHeatmap(currentHeatmapData, currentMonthOffset, 'left');
            updateNavButtons();
        });
    }

    window.addEventListener('resize', function() {
        if (resizeDebounceTimer) {
            clearTimeout(resizeDebounceTimer);
        }
        resizeDebounceTimer = setTimeout(function() {
            var layoutChanged = updateVisibleMonths();
            if (layoutChanged) {
                renderHeatmap(currentHeatmapData, currentMonthOffset);
            }
        }, 250);
    });
}

async function loadStatistics() {
    var booksEl = document.getElementById('stat-books-read-count');
    var vocabEl = document.getElementById('stat-vocab-count');
    var lexileEl = document.getElementById('stat-lexile-value');
    if (!booksEl || !vocabEl || !lexileEl) return;

    try {
        var resp = await Auth.fetch('/api/statistics/summary?days=90');
        if (!resp.ok) {
            console.error('Failed to fetch statistics:', resp.status);
            return;
        }
        var data = await resp.json();

        booksEl.textContent = data.total_books_read ?? 0;
        vocabEl.textContent = data.total_vocab_mastered ?? 0;
        lexileEl.textContent = data.avg_lexile_level ?? 0;

        if (data.heatmap && data.heatmap.length) {
            currentHeatmapData = data.heatmap;
            currentMonthOffset = 0;
            updateVisibleMonths();
            renderHeatmap(currentHeatmapData, currentMonthOffset);
            updateNavButtons();
        }
    } catch (err) {
        console.error('Error loading statistics:', err);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadStatistics();
    initHeatmapNavigation();
});
