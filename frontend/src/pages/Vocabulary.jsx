import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client'

export default function Vocabulary() {
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ total: 0, mastered: 0 })

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/vocabulary')
      const data = await res.json()
      const items = Array.isArray(data) ? data : (data?.data || [])
      setWords(items)
      setStats({
        total: items.length,
        mastered: items.filter(w => w.is_mastered).length,
      })
    } catch { setWords([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadWords() }, [loadWords])

  const toggleMastered = async (id) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, is_mastered: w.is_mastered ? 0 : 1 } : w))
    try {
      await apiFetch(`/api/vocabulary/${id}/toggle-mastered`, { method: 'PUT' })
    } catch { loadWords() }
  }

  const deleteWord = async (id) => {
    if (!window.confirm('Remove this word?')) return
    setWords(prev => prev.filter(w => w.id !== id))
    try { await apiFetch(`/api/vocabulary/${id}`, { method: 'DELETE' }) }
    catch { loadWords() }
  }

  const filtered = words
    .filter(w => {
      if (filter === 'mastered') return w.is_mastered
      if (filter === 'learning') return !w.is_mastered
      return true
    })
    .filter(w => {
      if (!search.trim()) return true
      const t = (w.text || '').toLowerCase()
      const tr = (w.translation || '').toLowerCase()
      const term = search.toLowerCase()
      return t.includes(term) || tr.includes(term)
    })

  return (
    <div className="p-7 pb-12 max-w-5xl">
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900">Vocabulary Notebook</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Track and review words &amp; sentences you've collected</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="font-serif text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="font-sans text-[10px] text-gray-400 uppercase tracking-wider">Words</p>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div className="text-center">
            <p className="font-serif text-2xl font-bold text-teal-600">{stats.mastered}</p>
            <p className="font-sans text-[10px] text-gray-400 uppercase tracking-wider">Mastered</p>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'learning', label: 'Learning' },
            { key: 'mastered', label: 'Mastered' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl font-sans text-sm font-medium transition-all ${
                filter === f.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search words..."
            className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 w-56"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <p className="font-sans">No vocabulary entries yet.</p>
          <p className="font-sans text-sm mt-1">Words you save while reading will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(word => (
            <div key={word.id} className="bg-white rounded-xl shadow-sm border border-gray-100/60 p-4 flex items-center gap-4 hover:shadow-md transition-all group">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${word.is_mastered ? 'bg-teal-400' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg font-semibold text-gray-800">{word.text}</p>
                <p className="font-sans text-sm text-gray-400 mt-0.5">{word.translation}</p>
                {word.context && <p className="font-sans text-xs text-gray-300 mt-0.5 truncate italic">"{word.context}"</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleMastered(word.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    word.is_mastered ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-teal-50 text-teal-500 hover:bg-teal-100'
                  }`}
                  title={word.is_mastered ? 'Mark as learning' : 'Mark as mastered'}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    {word.is_mastered ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                      : <polyline points="20 6 9 17 4 12" />}
                  </svg>
                </button>
                <button
                  onClick={() => deleteWord(word.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
