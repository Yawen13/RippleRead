import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getHeatmapColor(count) {
  if (count === 0) return 'bg-gray-50'
  if (count <= 2) return 'bg-teal-100'
  if (count <= 4) return 'bg-teal-200'
  if (count <= 6) return 'bg-teal-400'
  return 'bg-teal-600'
}

export default function Statistics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const visibleMonths = 5

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/statistics/summary?days=90')
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  if (loading) {
    return <div className="p-7 max-w-[1400px]"><div className="h-8 bg-gray-100 rounded w-64 animate-pulse mb-4" /><div className="grid grid-cols-3 gap-6 mb-10">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div></div>
  }

  if (!data) {
    return <div className="p-7 max-w-[1400px]"><p className="text-gray-400 font-sans">Failed to load statistics.</p></div>
  }

  const heatmap = data.heatmap || []

  const statCards = [
    { icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', value: data.total_books_read ?? 0, label: 'Books Completed', sub: 'Keep turning pages!' },
    { icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', value: data.total_vocab_mastered ?? 0, label: 'Vocabulary Mastered', sub: 'Every word counts!' },
    { icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', value: data.avg_lexile_level ?? 0, label: 'Average Lexile', sub: 'Your reading level grows!' },
  ]

  return (
    <div className="p-7 pb-12 max-w-[1400px]">
      <header className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-gray-900">Your Reading Journey</h1>
        <p className="font-serif text-gray-400 mt-2 text-lg">Every page you read shapes your tomorrow.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6">
            <svg className="w-4 h-4 text-teal-500 mb-4 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={s.icon} />
            </svg>
            <p className="font-sans text-[10px] text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="font-serif text-3xl font-normal text-gray-800 leading-none tracking-tight">{s.value}</p>
            <p className="font-sans text-[11px] text-gray-400 mt-1.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {heatmap.length > 0 && (
        <Heatmap heatmap={heatmap} offset={offset} visibleMonths={visibleMonths} onOffsetChange={setOffset} />
      )}
    </div>
  )
}

function Heatmap({ heatmap, offset, visibleMonths, onOffsetChange }) {
  const now = new Date()
  const months = []

  for (let i = 0; i < visibleMonths; i++) {
    const target = new Date(now.getFullYear(), now.getMonth() + offset + i, 1)
    const year = target.getFullYear()
    const month = target.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthData = []

    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const found = heatmap.find(h => h.date === ds)
      monthData.push(found || { date: ds, count: 0 })
    }

    const startOffset = ((new Date(year, month, 1).getDay() + 6) % 7)
    months.push({ label: `${FULL_MONTHS[month]} ${year}`, shortLabel: `${MONTHS[month]} ${year}`, data: monthData, startOffset })
  }

  const startLabel = months[0].label
  const endLabel = months[months.length - 1].label
  const leading = months[0].startOffset
  const flatCells = months.flatMap(m => m.data)
  const totalCells = leading + flatCells.length
  const totalCols = Math.ceil(totalCells / 7)
  const trailing = totalCols * 7 - totalCells
  const cellSize = 15
  const gap = 2

  let monthColSpans = []
  let acc = leading
  months.forEach(m => {
    const first = Math.floor(acc / 7)
    const last = Math.floor((acc + m.data.length - 1) / 7)
    monthColSpans.push({ label: m.shortLabel, startCol: first, endCol: last })
    acc += m.data.length
  })

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-xl font-semibold text-gray-900">Reading Activity</h2>
          <p className="font-sans text-sm text-gray-400 mt-1">Your reading journey over the past 90 days.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOffsetChange(offset - 1)}
            disabled={offset <= -11}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="font-sans text-sm text-gray-600 min-w-[200px] text-center">{visibleMonths > 1 ? `${startLabel} - ${endLabel}` : startLabel}</span>
          <button
            onClick={() => onOffsetChange(offset + 1)}
            disabled={offset >= 0}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 text-[10px] text-gray-400 font-sans">
        <span>Less</span>
        {[0, 1, 3, 5, 7].map(n => (
          <div key={n} className={`w-4 h-4 rounded-sm ${getHeatmapColor(n)}`} style={{ border: '1px solid rgba(0,0,0,0.04)' }} />
        ))}
        <span>More</span>
      </div>

      <div style={{ width: `${totalCols * (cellSize + gap)}px`, maxWidth: '100%', overflowX: 'auto' }}>
        <div style={{ position: 'relative', height: '18px', marginBottom: '4px', width: `${totalCols * (cellSize + gap)}px` }}>
          {monthColSpans.map((mc, i) => (
            <span key={i} className="absolute font-sans text-[9px] text-gray-400" style={{ left: `${mc.startCol * (cellSize + gap)}px` }}>
              {mc.label}
            </span>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${totalCols}, ${cellSize}px)`,
            gap: `${gap}px`,
            gridTemplateRows: `repeat(7, ${cellSize}px)`,
            gridAutoFlow: 'column',
          }}
        >
          {Array.from({ length: leading }).map((_, i) => (
            <div key={`ph-${i}`} className="rounded-sm bg-transparent" style={{ width: cellSize, height: cellSize }} />
          ))}
          {flatCells.map((cell, i) => (
            <div
              key={i}
              className={`rounded-sm ${getHeatmapColor(cell.count)}`}
              style={{ width: cellSize, height: cellSize, border: '1px solid rgba(0,0,0,0.03)' }}
              title={`${cell.date}: ${cell.count} actions`}
            />
          ))}
          {Array.from({ length: trailing }).map((_, i) => (
            <div key={`tr-${i}`} className="rounded-sm bg-transparent" style={{ width: cellSize, height: cellSize }} />
          ))}
        </div>
      </div>
    </div>
  )
}
