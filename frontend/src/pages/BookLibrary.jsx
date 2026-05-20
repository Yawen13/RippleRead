import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api/client'

const MORANDI_COLORS = ['#2D403E','#4A5568','#5C6B73','#6B5B4F','#7D6E63','#8C7A6B','#3D4F4A','#4E5B50','#5A4E4D','#3E4A4B']
const MORANDI_LIGHTS = ['#D2C9BD','#E8E5DF','#C5BFB5','#D9D2C5','#E0DCD3','#CCC4B8','#DFD9CE','#C8C0B6','#DBD5CA','#D4CFC5']

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}

function pickColor(title) {
  if (!title) return MORANDI_COLORS[0]
  const h = hashStr(title)
  return (h % 2 === 0) ? MORANDI_COLORS[h % MORANDI_COLORS.length] : MORANDI_LIGHTS[h % MORANDI_LIGHTS.length]
}

function isDark(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return (0.299*r + 0.587*g + 0.114*b)/255 < 0.55
}

function coverWords(title) {
  if (!title) return 'Book'
  const words = title.replace(/\s+/g,' ').trim().split(' ')
  const display = words.slice(0,2).join(' ')
  return display.length < 4 && words.length === 1 ? title.substring(0,12) : display
}

export default function BookLibrary() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('title')
  const [gutenResults, setGutenResults] = useState([])
  const [gutenSearching, setGutenSearching] = useState(false)
  const [gutenTimeout, setGutenTimeout] = useState(null)
  const [importing, setImporting] = useState(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const loadBooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/books')
      const data = await res.json()
      setBooks(Array.isArray(data) ? data : [])
    } catch { setBooks([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadBooks() }, [loadBooks])

  const searchOnline = useCallback(async (q) => {
    if (!q.trim()) { setGutenResults([]); return }
    setGutenSearching(true)
    try {
      const res = await apiFetch(`/search/online?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setGutenResults(Array.isArray(data) ? data : [])
    } catch { setGutenResults([]) }
    finally { setGutenSearching(false) }
  }, [])

  const handleGutenInput = (q) => {
    setQuery(q)
    if (gutenTimeout) clearTimeout(gutenTimeout)
    setGutenTimeout(setTimeout(() => searchOnline(q), 400))
  }

  const handleImport = async (book) => {
    setImporting(book.source_id || book.id)
    try {
      const res = await apiFetch(`/books/${book.source_id || book.id}/import`, { method: 'POST' })
      const data = await res.json()
      if (data?.code === 0) {
        await loadBooks()
        navigate(`/reader?id=${data.data?.library_id || data.data?.id}`)
      }
    } catch {}
    finally { setImporting(null) }
  }

  const filtered = books
    .filter(b => {
      const q = searchParams.get('q') || ''
      if (!q) return true
      const t = (b.title || '').toLowerCase()
      const a = (b.author || '').toLowerCase()
      const term = q.toLowerCase()
      return t.includes(term) || a.includes(term)
    })
    .sort((a, b) => {
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '')
      if (sort === 'author') return (a.author || '').localeCompare(b.author || '')
      if (sort === 'lexile') return (b.lexile_level || 0) - (a.lexile_level || 0)
      return 0
    })

  return (
    <div className="p-7 pb-12 max-w-[1440px]">
      <div className="bg-gradient-to-r from-teal-50 to-sky-50 rounded-2xl p-6 mb-6">
        <h2 className="font-serif text-xl font-bold text-gray-800">Find &amp; Read Classics</h2>
        <p className="text-gray-500 font-sans text-sm mt-1">
          Browse 100 curated classics below, or search <strong>70,000+ free books</strong> from Project Gutenberg.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/60 p-5 mb-8">
        <h3 className="font-sans text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Search Project Gutenberg
        </h3>
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={query}
            onChange={e => handleGutenInput(e.target.value)}
            placeholder='e.g. "Jane Austen", "Sherlock Holmes"...'
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="font-sans text-xs text-gray-400 pt-1">Try:</span>
          {['Pride and Prejudice','Moby Dick','Frankenstein','Sherlock Holmes','Dracula'].map(t => (
            <button key={t} onClick={() => handleGutenInput(t)} className="px-3 py-1 rounded-lg bg-gray-50 text-gray-600 font-sans text-xs hover:bg-teal-50 hover:text-teal-600 transition-colors">{t}</button>
          ))}
        </div>

        {gutenSearching && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl"><div className="h-3 bg-gray-200 rounded animate-pulse w-48" /></div>
        )}

        {gutenResults.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            {gutenResults.slice(0, 20).map(b => (
              <div key={b.source_id || b.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-teal-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm font-semibold text-gray-800 truncate">{b.title}</p>
                  <p className="font-sans text-xs text-gray-400">{b.author || 'Unknown'}</p>
                </div>
                <button
                  onClick={() => handleImport(b)}
                  disabled={importing === (b.source_id || b.id)}
                  className="px-4 py-1.5 bg-teal-500 text-white font-sans text-xs font-medium rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {importing === (b.source_id || b.id) ? 'Importing...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-bold text-gray-800">Curated Classics</h2>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 font-sans text-sm text-gray-600 bg-white"
        >
          <option value="title">Sort by Title</option>
          <option value="author">Sort by Author</option>
          <option value="lexile">Sort by Lexile</option>
        </select>
      </div>

      {loading ? (
        <div style={{ columns: '5 200px', columnGap: '16px' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse mb-4" style={{ height: `${180 + Math.random() * 80}px`, breakInside: 'avoid' }} />
          ))}
        </div>
      ) : (
        <div style={{ columns: '5 200px', columnGap: '16px' }}>
          {filtered.map((book, idx) => {
            const bg = pickColor(book.title)
            const dark = isDark(bg)
            return (
              <div
                key={book.id || idx}
                onClick={() => navigate(`/reader?id=${book.id}`)}
                className="rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all mb-4"
                style={{ breakInside: 'avoid' }}
              >
                <div
                  className="p-6 flex flex-col items-center justify-center text-center min-h-[180px]"
                  style={{ background: `linear-gradient(135deg, ${bg}, ${bg}ee)` }}
                >
                  <span className={`font-serif text-lg font-bold leading-tight ${dark ? 'text-white/90' : 'text-gray-700'}`}>
                    {coverWords(book.title)}
                  </span>
                  {book.author && (
                    <span className={`font-sans text-xs mt-2 ${dark ? 'text-white/60' : 'text-gray-500'}`}>{book.author}</span>
                  )}
                </div>
                <div className="bg-white p-3">
                  <p className="font-serif text-sm font-semibold text-gray-800 truncate">{book.title}</p>
                  <p className="font-sans text-xs text-gray-400 truncate">{book.author || 'Unknown'}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-sans text-[0.6rem] text-gray-300">{book.lexile_level}L</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
