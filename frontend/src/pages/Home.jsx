import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../api/auth'
import { apiFetch } from '../api/client'

const DASHBOARD_CACHE_KEY = 'rr_dashboard_v1'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const displayName = user?.name || 'Explorer'

  const loadDashboard = useCallback(async (retryCount = 0) => {
    try {
      const cached = localStorage.getItem(DASHBOARD_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.data) setData(parsed.data)
      }
    } catch {}

    try {
      const res = await apiFetch('/api/home/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      if (d?.code === 0 && d?.data) {
        try { localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(d)) } catch {}
        setData(d.data)
      }
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err)
      if (retryCount < 2) {
        setTimeout(() => loadDashboard(retryCount + 1), 500 * (retryCount + 1))
        return
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  if (loading && !data) {
    return (
      <div className="p-8 max-w-[1440px]">
        <Skeleton />
      </div>
    )
  }

  return (
    <div className="p-7 pb-12 max-w-[1440px]">
      <HeaderRow displayName={displayName} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', marginBottom: '32px' }}>
        <ContinueReading book={data?.continue_reading} />
        <TodayGoal goal={data?.goal} userStats={data?.user_stats} />
      </div>
      <Recommendations books={data?.recommendations} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <Articles articles={data?.articles} />
        <Insights stats={data?.stats} />
      </div>
    </div>
  )
}

function HeaderRow({ displayName }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
      <div>
        <h2 className="font-serif text-[1.6rem] font-bold text-gray-900 leading-tight">
          Welcome back, <span className="text-teal-600">{displayName}</span>
        </h2>
        <p className="text-sm text-gray-400 mt-0.5 font-sans">Every page you read today is a step toward a better tomorrow.</p>
      </div>
      <SearchBar />
    </div>
  )
}

function SearchBar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && e.target !== inputRef.current) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setOpen(false); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      setOpen(true)
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const d = await res.json()
        if (d?.code === 0 && d?.data) setResults(d.data)
        else setResults(null)
      } catch { setResults(null) }
      finally { setSearchLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const SECTION_CONFIG = {
    library:  { label: 'My Library' },
    books:    { label: 'Classic Library' },
    vocabulary: { label: 'Vocabulary Notes' },
  }

  function navigateResult(section, id) {
    setOpen(false)
    if (section === 'library') navigate(`/reader?id=${id}`)
    else if (section === 'books') navigate(`/books?highlight=${id}`)
    else if (section === 'vocabulary') navigate(`/vocabulary?highlight=${id}`)
  }

  function viewAll(section) {
    setOpen(false)
    if (section === 'library') navigate(`/library?q=${encodeURIComponent(query)}`)
    else if (section === 'books') navigate(`/books?q=${encodeURIComponent(query)}`)
    else if (section === 'vocabulary') navigate(`/vocabulary?q=${encodeURIComponent(query)}`)
  }

  const hasResults = results && (results.library?.length || results.books?.length || results.vocabulary?.length)

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg style={{ position: 'absolute', left: '14px', width: '18px', height: '18px', color: '#94A3B8' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true) }}
          placeholder="Search books, articles, notes..."
          className="font-sans text-sm bg-white/70 backdrop-blur border border-gray-200/80 rounded-2xl py-2.5 pl-11 pr-14 w-72 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
        />
        <span style={{ position: 'absolute', right: '14px', fontSize: '0.65rem', color: '#94A3B8', fontFamily: 'Inter, sans-serif', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl+K</span>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '380px', background: 'white', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)', zIndex: 50, maxHeight: '480px', overflow: 'hidden' }}>
          {searchLoading ? (
            <div className="p-4">
              {[1,2,3].map(i => <div key={i} className="h-3 bg-gray-100 rounded mb-3 animate-pulse" style={{ width: `${100 - i * 20}%` }} />)}
            </div>
          ) : hasResults ? (
            <div>
              {Object.keys(SECTION_CONFIG).map(key => {
                const items = results[key]
                if (!items?.length) return null
                const cfg = SECTION_CONFIG[key]
                return (
                  <div key={key}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">{cfg.label}</div>
                    {items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => navigateResult(key, item.id)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate" dangerouslySetInnerHTML={{ __html: item.highlight || (item.title || item.word || '') }} />
                          <div className="text-xs text-gray-400 truncate">{item.author || item.translation || ''}</div>
                        </div>
                      </div>
                    ))}
                    <div onClick={() => viewAll(key)} className="px-4 py-2 text-xs text-teal-600 font-medium hover:bg-teal-50 cursor-pointer font-sans">
                      View all in {cfg.label} &rarr;
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <svg className="w-8 h-8 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              <span className="text-sm font-sans">No results found</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ContinueReading({ book }) {
  const navigate = useNavigate()

  if (!book || book._error) {
    return (
      <div className="rounded-[20px] bg-white/65 backdrop-blur-lg shadow-sm border border-gray-100/60 flex items-center justify-center h-[88px]">
        <span className="font-serif text-sm text-gray-400 italic">Start your reading journey</span>
      </div>
    )
  }

  const prog = book.progress_percentage || 0
  const chapter = book.current_chapter || 1
  const total = book.total_chapters || 1
  const estMin = book.minutes_left || 0

  return (
    <div
      onClick={() => navigate(`/reader?id=${book.id}`)}
      className="rounded-[20px] bg-white/65 backdrop-blur-lg shadow-sm border border-gray-100/60 flex items-center gap-4 h-[88px] px-3 cursor-pointer transition-shadow hover:shadow-md"
    >
      <div className="w-12 h-16 rounded-md overflow-hidden bg-gradient-to-br from-teal-50 to-teal-100/30 flex items-center justify-center flex-shrink-0 shadow-inner">
        {book.cover_url ? (
          <img src={book.cover_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; e.target.parentElement.classList.add('bg-teal-100/40') }} />
        ) : (
          <svg className="w-5 h-5 text-teal-600/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <span className="font-sans text-[0.6rem] font-medium uppercase tracking-wider text-gray-400">Continue Reading</span>
        <span className="font-serif text-[0.95rem] font-semibold text-gray-800 truncate tracking-tight">{book.title || 'Untitled'}</span>
        <div className="w-full max-w-[200px]">
          <div className="h-[3px] rounded-sm bg-gray-100 overflow-hidden">
            <div className="h-full rounded-sm bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-500" style={{ width: `${prog}%` }} />
          </div>
        </div>
      </div>

      <button className="flex items-center gap-1.5 h-[38px] px-4 rounded-[20px] bg-teal-50 text-teal-600 font-sans text-[0.72rem] font-medium hover:bg-teal-100 transition-colors flex-shrink-0 border-0 cursor-pointer">
        <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21" /></svg>
        Resume
      </button>
    </div>
  )
}

function TodayGoal({ goal, userStats }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [localGoal, setLocalGoal] = useState(null)

  const goalMin = localGoal?.goal_minutes ?? goal?.goal_minutes ?? userStats?.goal_minutes ?? 30
  const todayMin = goal?.today_minutes ?? 0
  const pct = goal?.progress_percent ?? 0
  const streakDays = goal?.streak_days ?? 0
  const chart = goal?.weekly_chart ?? [0, 0, 0, 0, 0, 0, 0]

  const dash = 97.39
  const offset = dash - (dash * Math.min(pct, 100) / 100)
  const todayIdx = (new Date().getDay() + 6) % 7
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const maxVal = Math.max(1, ...chart)

  async function saveGoal() {
    const val = parseInt(editVal, 10)
    if (isNaN(val) || val < 5 || val > 240) return
    setEditing(false)
    try {
      await apiFetch('/api/home/dashboard/goal', {
        method: 'PUT',
        body: { goal_minutes: val },
      })
      setLocalGoal({ goal_minutes: val, today_minutes: todayMin, progress_percent: Math.min(100, Math.round(todayMin / val * 100)), streak_days: streakDays, weekly_chart: chart })
    } catch { /* will refresh on next load */ }
  }

  return (
    <div className="rounded-[20px] bg-white shadow-sm border border-gray-100/60 p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-sans text-sm font-semibold text-gray-800">Today's Goal</h3>
        <button onClick={() => navigate('/statistics')} className="text-xs text-teal-600 font-sans font-medium bg-transparent border-0 cursor-pointer hover:underline">More &gt;</button>
      </div>

      <div className="flex items-center gap-5 flex-1">
        <div className="relative flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-[80px] h-[80px] -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="2" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={pct >= 100 ? '#0D9488' : '#14B8A6'} strokeWidth="2" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer" onClick={() => { setEditVal(String(goalMin)); setEditing(true) }}>
            {editing ? (
              <div className="absolute bg-white shadow-lg rounded-xl p-2 border z-10" onClick={e => e.stopPropagation()}>
                <input
                  type="number"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  min="5" max="240"
                  className="w-20 text-center text-sm font-sans border rounded-lg p-1 mx-0.5"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditing(false) }}
                />
                <button onClick={saveGoal} className="text-xs bg-teal-500 text-white rounded-lg px-2 py-1 ml-1">Save</button>
              </div>
            ) : (
              <>
                <span className="font-serif text-lg font-bold text-gray-800">{todayMin}</span>
                <span className="font-sans text-[0.6rem] text-gray-400">/ {goalMin} min</span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {streakDays > 0 ? (
            <p className="font-sans text-sm font-semibold text-gray-700">
              {streakDays === 1 ? '1-day streak' : `${streakDays}-day streak`}
            </p>
          ) : (
            <p className="font-sans text-sm text-gray-400">Start your streak today</p>
          )}
          <p className="font-sans text-xs text-gray-400 mt-0.5">{goal?.cta_text || ''}</p>
          <p className="font-sans text-[0.65rem] text-gray-300">{goal?.sub_text || ''}</p>
        </div>
      </div>

      <div className="flex items-end gap-1.5 mt-3" style={{ height: '54px' }}>
        {chart.map((v, i) => {
          const isFuture = i > todayIdx
          const h = v > 0 ? Math.max(6, Math.min(54, v / maxVal * 54)) : 6
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${h}px`,
                  background: v > 0 ? 'linear-gradient(180deg, #14B8A6, #0D9488)' : (i === todayIdx ? '#e2e8f0' : '#f1f5f9'),
                  opacity: isFuture ? 0.3 : 1,
                }}
              />
              <span className="font-sans text-[0.55rem] text-gray-300">{days[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Recommendations({ books }) {
  const navigate = useNavigate()
  const scrollRef = useRef(null)

  if (!books?.length) return null

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-bold text-gray-800">Recommended For You</h2>
        <button onClick={() => navigate('/books')} className="text-sm text-teal-600 font-sans font-medium bg-transparent border-0 cursor-pointer hover:underline">View All &rarr;</button>
      </div>
      <div className="relative">
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth" style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
          {books.map(book => (
            <div
              key={book.id}
              onClick={() => navigate(`/reader?id=${book.id}`)}
              className="flex-shrink-0 w-[220px] bg-white rounded-2xl shadow-sm border border-gray-100/60 overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="h-[180px] bg-gradient-to-br from-teal-50 to-sky-50 flex items-center justify-center overflow-hidden">
                {book.cover_url ? (
                  <img src={book.cover_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <span className="font-serif text-3xl font-bold text-teal-300/40">{book.title?.charAt(0)?.toUpperCase()}</span>
                )}
              </div>
              <div className="p-3">
                <span className="inline-block font-sans text-[0.6rem] font-semibold uppercase tracking-wider text-teal-500 bg-teal-50 px-2 py-0.5 rounded-full mb-1.5">
                  {book.recommendation_reason || "Editor's choice"}
                  {book.match_percentage != null ? ` · ${book.match_percentage}% match` : ''}
                </span>
                <p className="font-serif text-sm font-semibold text-gray-800 truncate">{book.title}</p>
                <p className="font-sans text-xs text-gray-400 truncate">{book.author}</p>
                <span className="font-sans text-[0.65rem] text-gray-300">{book.lexile_level}L</span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: scrollRef.current?.clientWidth * 0.75, behavior: 'smooth' })}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center border border-gray-200 cursor-pointer hover:shadow-xl transition-all"
          aria-label="Scroll next"
        >
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </section>
  )
}

function Articles({ articles }) {
  const ARTICLE_THUMBS = [
    'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=400',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=400',
  ]

  if (!articles?.length) return null

  return (
    <div className="rounded-[20px] bg-white shadow-sm border border-gray-100/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-bold text-gray-800">Daily Articles</h2>
        <button onClick={() => navigate('/news')} className="text-sm text-teal-600 font-sans font-medium bg-transparent border-0 cursor-pointer hover:underline">View All</button>
      </div>
      <div className="flex gap-4">
        {articles.slice(0, 2).map((a, i) => (
          <div key={a.id || i} onClick={() => navigate(`/reader?id=${a.id}`)} className="flex-1 rounded-xl overflow-hidden bg-gray-50 cursor-pointer hover:shadow-md transition-shadow">
            <div className="h-28 overflow-hidden">
              <img src={ARTICLE_THUMBS[i]} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
            </div>
            <div className="p-3">
              <span className="font-sans text-[0.6rem] font-semibold text-teal-500 uppercase tracking-wider">Psychology</span>
              <h4 className="font-serif text-[0.85rem] font-semibold text-gray-800 mt-0.5 line-clamp-2">{a.title || 'Untitled'}</h4>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="font-sans text-[0.65rem] text-gray-400">~{a.predicted_read_time || 8} min</span>
                <span className="font-sans text-[0.65rem] text-gray-300">{a.lexile_level || 'N/A'}L</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Insights({ stats }) {
  const items = [
    { value: stats?.time_this_week || '0h', label: 'Hours Read', delta: stats?.deltas?.time_delta || '' },
    { value: stats?.books_read || 0, label: 'Books Finished', delta: stats?.deltas?.books_delta || '' },
    { value: stats?.words_saved || 0, label: 'Highlights', delta: stats?.deltas?.words_delta || '' },
    { value: stats?.day_streak || 0, label: 'Notes Taken', delta: stats?.deltas?.streak_delta || '' },
  ]

  return (
    <div className="rounded-[20px] bg-white shadow-sm border border-gray-100/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-bold text-gray-800">Your Reading Insights</h2>
        <span className="font-sans text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full">This Week</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((s, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[i]}
              </svg>
            </div>
            <div>
              <p className="font-sans text-base font-bold text-gray-800">{s.value}</p>
              <p className="font-sans text-[0.65rem] text-gray-400">{s.label}</p>
              {s.delta && <span className="font-sans text-[0.6rem] text-teal-500 font-medium">{s.delta}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const ICONS = [
  <g key="0"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></g>,
  <g key="1"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></g>,
  <g key="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></g>,
  <g key="3"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></g>,
]

function Skeleton() {
  return (
    <>
      <div className="h-8 bg-gray-100 rounded w-64 mb-2 animate-pulse" />
      <div className="h-4 bg-gray-100 rounded w-48 mb-8 animate-pulse" />
      <div className="grid grid-cols-[1fr_380px] gap-6 mb-8">
        <div className="h-[88px] bg-gray-100 rounded-[20px] animate-pulse" />
        <div className="h-[200px] bg-gray-100 rounded-[20px] animate-pulse" />
      </div>
      <div className="flex gap-4 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="w-[220px] h-[280px] bg-gray-100 rounded-2xl flex-shrink-0 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-[200px] bg-gray-100 rounded-[20px] animate-pulse" />
        <div className="h-[200px] bg-gray-100 rounded-[20px] animate-pulse" />
      </div>
    </>
  )
}
