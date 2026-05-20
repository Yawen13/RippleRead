import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'

const ARTICLE_THUMBS = [
  'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=600',
  'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600',
  'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600',
]

const CATEGORIES = ['all', 'general', 'technology', 'business', 'science', 'sports']

function estimateReadTime(content) {
  if (!content) return 5
  const words = content.trim().split(/\s+/).length
  return Math.max(3, Math.ceil(words / 200))
}

function getExcerpt(content) {
  if (!content) return ''
  const plain = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > 200 ? plain.substring(0, 200).replace(/\s\S*$/, '') + '...' : plain
}

export default function News() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [category, setCategory] = useState('all')
  const navigate = useNavigate()

  const loadArticles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/news/library')
      const data = await res.json()
      setArticles(Array.isArray(data) ? data : [])
    } catch { setArticles([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadArticles() }, [loadArticles])

  const handleFetchLatest = async () => {
    setFetching(true)
    try {
      const res = await apiFetch('/api/fetch-news', { method: 'POST' })
      const data = await res.json()
      if (data?.code === 0) await loadArticles()
    } catch {}
    finally { setFetching(false) }
  }

  const filtered = category === 'all' ? articles : articles.filter(a => (a.category || '').toLowerCase() === category)

  return (
    <div className="p-7 pb-12 max-w-[1440px]">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-gray-800">News</h1>
        <p className="text-gray-400 font-sans text-sm mt-1">Stay informed with curated articles at your reading level</p>
      </header>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-xl font-sans text-sm font-medium transition-all ${
                category === cat
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-300 hover:text-teal-600'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={handleFetchLatest}
          disabled={fetching}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white font-sans text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60"
        >
          <svg className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          {fetching ? 'Fetching...' : 'Fetch Latest'}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse" style={{ height: '320px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p className="font-sans">No articles found in this category yet.</p>
          <p className="font-sans text-sm mt-1">Click "Fetch Latest" to pull fresh news.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((article, idx) => (
            <div
              key={article.id || idx}
              onClick={() => article.id && navigate(`/reader?id=${article.id}`)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100/60 overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="h-48 overflow-hidden relative">
                <img
                  src={ARTICLE_THUMBS[idx % ARTICLE_THUMBS.length]}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => {
                    const d = document.createElement('div')
                    d.className = 'w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 font-serif text-lg font-bold'
                    d.textContent = (article.source || article.author || 'N').charAt(0).toUpperCase()
                    e.target.replaceWith(d)
                  }}
                />
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <span className="px-2 py-0.5 bg-white/90 backdrop-blur rounded-lg font-sans text-[0.6rem] font-semibold text-gray-700">{article.author || article.source || 'News'}</span>
                  <span className="px-2 py-0.5 bg-teal-500/90 backdrop-blur rounded-lg font-sans text-[0.6rem] font-semibold text-white">{article.category || 'general'}</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-serif text-[0.95rem] font-semibold text-gray-800 leading-snug line-clamp-2">{article.title || 'Untitled'}</h3>
                {getExcerpt(article.content) && (
                  <p className="font-sans text-xs text-gray-400 mt-1.5 line-clamp-3">{getExcerpt(article.content)}</p>
                )}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                  <span className="font-sans text-[0.65rem] text-gray-400">~{estimateReadTime(article.content)} min read</span>
                  <span className="font-sans text-[0.65rem] text-gray-300">{article.lexile_level ?? 'N/A'}L</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
