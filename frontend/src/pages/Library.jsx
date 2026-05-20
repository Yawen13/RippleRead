import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'

const COVER_PALETTE = ['cover--parchment','cover--forest','cover--slate','cover--warm-brown','cover--blue-gray','cover--taupe','cover--dusty-rose','cover--moss','cover--charcoal','cover--cream']

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'books', label: 'Books' },
  { key: 'saved', label: 'Favorites' },
]

export default function Library() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [urlImporting, setUrlImporting] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/library')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = items
    .filter(item => {
      if (filter === 'books') return (item.source_type ?? '') !== 'news'
      if (filter === 'saved') return item.is_saved
      return true
    })
    .filter(item => {
      if (!search.trim()) return true
      const t = (item.title || '').toLowerCase()
      const a = (item.author || '').toLowerCase()
      const term = search.toLowerCase()
      return t.includes(term) || a.includes(term)
    })

  const toggleFavorite = async (itemId) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, is_saved: it.is_saved ? 0 : 1 } : it))
    showToast('Updated')
    try {
      await apiFetch(`/api/library/${itemId}/favorite`, { method: 'PUT' })
    } catch {
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, is_saved: it.is_saved ? 1 : 0 } : it))
      showToast('Failed to update', 'error')
    }
  }

  const deleteItem = async (itemId) => {
    if (!window.confirm('Remove this item from your library?')) return
    setItems(prev => prev.filter(it => it.id !== itemId))
    showToast('Removed')
    try {
      await apiFetch(`/api/library/${itemId}`, { method: 'DELETE' })
    } catch {
      loadItems()
      showToast('Failed to delete', 'error')
    }
  }

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch('/api/upload-book', { method: 'POST', body: form, headers: {} })
      const data = await res.json()
      if (data?.code === 0) {
        showToast('Book imported!')
        await loadItems()
      } else {
        showToast(data?.detail || 'Import failed', 'error')
      }
    } catch { showToast('Import failed', 'error') }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleUrlImport = async () => {
    if (!urlValue.trim()) return
    setUrlImporting(true)
    try {
      const res = await apiFetch('/api/import/url', {
        method: 'POST',
        body: { url: urlValue.trim() },
      })
      const data = await res.json()
      if (data?.code === 0) {
        showToast('Article imported!')
        setUrlValue('')
        await loadItems()
      } else {
        showToast(data?.detail || 'Import failed', 'error')
      }
    } catch { showToast('Import failed', 'error') }
    finally { setUrlImporting(false) }
  }

  return (
    <div className="p-7 pb-12 max-w-[1440px]">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-gray-800">My Library</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/60 p-5 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <h4 className="font-sans text-sm font-semibold text-gray-700">Import Ebook</h4>
          <p className="font-sans text-xs text-gray-400 mt-1 mb-3">Upload .txt or .epub files</p>
          <input ref={fileInputRef} type="file" accept=".txt,.epub" hidden onChange={handleFileImport} />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="px-5 py-2 bg-teal-500 text-white font-sans text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60">
            {importing ? 'Importing...' : 'Choose File'}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </div>
            <div>
              <h4 className="font-sans text-sm font-semibold text-gray-700">Paste Article URL</h4>
              <p className="font-sans text-xs text-gray-400">Import any web article</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlValue}
              onChange={e => setUrlValue(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
            />
            <button onClick={handleUrlImport} disabled={urlImporting} className="px-4 py-2 bg-teal-500 text-white font-sans text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60">
              {urlImporting ? '...' : 'Import'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/60 p-5 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          </div>
          <h4 className="font-sans text-sm font-semibold text-gray-700">Browse Gutenberg</h4>
          <p className="font-sans text-xs text-gray-400 mt-1 mb-3">Search 70,000+ free classics</p>
          <button onClick={() => navigate('/books')} className="px-5 py-2 bg-amber-100 text-amber-700 font-sans text-sm font-medium rounded-xl hover:bg-amber-200 transition-colors">
            Browse Books
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {FILTERS.map(f => (
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
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search library..."
            className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse" style={{ height: '280px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <p className="font-sans">Your library is empty.</p>
          <p className="font-sans text-sm mt-1">Import an ebook or paste an article URL above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((item, idx) => {
            const colorIdx = idx % COVER_PALETTE.length
            const hasCover = item.cover_url && item.cover_url.startsWith('http') && !item.cover_url.includes('placehold.co')
            const isNews = (item.source_type ?? '') === 'news'
            const progress = item.progress ?? 0
            return (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100/60 overflow-hidden hover:shadow-md transition-all group">
                <div className="relative">
                  <div
                    onClick={() => navigate(`/reader?id=${item.id}`)}
                    className={`h-44 flex items-center justify-center cursor-pointer relative ${!hasCover ? COVER_STYLES[colorIdx] : ''}`}
                  >
                    {hasCover ? (
                      <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center px-2">
                        <p className="font-serif text-lg font-bold text-white/90 leading-tight">{(item.title || '').substring(0, 40)}</p>
                        {item.author && <p className="font-sans text-xs text-white/60 mt-1">{item.author}</p>}
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur rounded-lg font-sans text-[0.55rem] font-semibold text-gray-600 uppercase">
                      {isNews ? 'News' : 'Book'}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorite(item.id) }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${item.is_saved ? 'bg-red-50 text-red-500' : 'bg-white/90 text-gray-400 hover:text-red-400'}`}
                      title={item.is_saved ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={item.is_saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                      className="w-7 h-7 rounded-lg bg-white/90 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div onClick={() => navigate(`/reader?id=${item.id}`)} className="p-3 cursor-pointer">
                  <p className="font-serif text-sm font-semibold text-gray-800 truncate">{item.title || 'Untitled'}</p>
                  {item.author && <p className="font-sans text-xs text-gray-400 truncate mt-0.5">{item.author}</p>}
                  {!isNews && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="font-sans text-[0.6rem] text-gray-400">{progress}%</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg font-sans text-sm transition-all ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

const COVER_STYLES = [
  'bg-gradient-to-br from-[#D2C9BD] to-[#B8A99A]',
  'bg-gradient-to-br from-[#2D403E] to-[#1A2A28]',
  'bg-gradient-to-br from-[#4A5568] to-[#2D3748]',
  'bg-gradient-to-br from-[#6B5B4F] to-[#4A3D34]',
  'bg-gradient-to-br from-[#5C6B73] to-[#3A4A52]',
  'bg-gradient-to-br from-[#8C7A6B] to-[#6B5A4E]',
  'bg-gradient-to-br from-[#C5BFB5] to-[#A8A197]',
  'bg-gradient-to-br from-[#3E4A4B] to-[#2A3334]',
  'bg-gradient-to-br from-[#4E5B50] to-[#334037]',
  'bg-gradient-to-br from-[#D9D2C5] to-[#C4BBA9]',
]
