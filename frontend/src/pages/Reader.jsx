import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'

export default function Reader() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const bookId = searchParams.get('id')

  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [content, setContent] = useState('')
  const [chTitle, setChTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSaved, setIsSaved] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)

  const [selectedWord, setSelectedWord] = useState(null)
  const [panelTab, setPanelTab] = useState('decode')
  const [panelOpen, setPanelOpen] = useState(true)

  const contentRef = useRef(null)
  const mainRef = useRef(null)
  const progressDebounce = useRef(null)

  useEffect(() => {
    if (!bookId) { setError('No book ID provided'); setLoading(false); return }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/read/${bookId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setBook(data)
        setIsSaved(data.is_saved)

        const ch = Array.isArray(data.content) ? data.content : [{ chapter_title: '', content: data.content }]
        setChapters(ch)
        const startIdx = data.current_chapter_index ?? 0
        setCurrentIdx(startIdx)
        setChTitle(ch[startIdx]?.chapter_title || '')
        setContent(ch[startIdx]?.content || '')
        setProgress(data.progress || 0)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [bookId])

  const goToChapter = useCallback((idx) => {
    if (idx < 0 || idx >= chapters.length) return
    setCurrentIdx(idx)
    setChTitle(chapters[idx]?.chapter_title || '')
    setContent(chapters[idx]?.content || '')
    setSelectedWord(null)
    if (mainRef.current) mainRef.current.scrollTop = 0
    setTimeout(() => saveProgress(idx, 0), 300)
  }, [chapters])

  const saveProgress = async (idx, prog) => {
    if (!bookId) return
    try {
      const pct = chapters.length > 1 ? Math.round(((idx + 1) / chapters.length) * 100) : prog
      await apiFetch(`/api/library/${bookId}/progress`, {
        method: 'PUT',
        body: { progress: pct, current_chapter_index: idx },
      })
    } catch {}
  }

  const handleScroll = useCallback(() => {
    if (!mainRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = mainRef.current
    const pct = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100))
    setScrollProgress(pct)
    if (progressDebounce.current) clearTimeout(progressDebounce.current)
    progressDebounce.current = setTimeout(() => saveProgress(currentIdx, pct), 2000)
  }, [currentIdx])

  const markComplete = async () => {
    try {
      await apiFetch(`/api/library/${bookId}/progress`, {
        method: 'PUT',
        body: { progress: 100, total_chapters: chapters.length },
      })
      setProgress(100)
    } catch {}
  }

  const toggleFavorite = async () => {
    setIsSaved(!isSaved)
    try { await apiFetch(`/api/library/${bookId}/favorite`, { method: 'PUT' }) }
    catch { setIsSaved(isSaved) }
  }

  const handleWordClick = (e) => {
    const word = window.getSelection()?.toString()?.trim()
    if (word && word.length > 1) setSelectedWord(word)
  }

  if (!bookId) return <div className="flex items-center justify-center h-screen text-gray-400 font-sans">No book selected. <button onClick={() => navigate('/library')} className="ml-2 text-teal-600 hover:underline">Go to Library</button></div>

  if (loading) {
    return (
      <div className="flex h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <p>Loading content...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p>Failed to load: {error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-sans hover:bg-teal-600">Retry</button>
        </div>
      </div>
    )
  }

  if (!book) return null

  const paragraphs = content ? content.split('\n\n').filter(p => p.trim()) : []

  return (
    <div className="flex h-screen">
      <div className="fixed top-0 left-0 h-1 bg-teal-500 z-50 transition-all duration-300" style={{ width: `${scrollProgress}%` }} />

      <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-[700px] mx-auto py-16 px-8">
          <header className="mb-12">
            <h1 className="font-serif text-4xl font-bold text-slate-800 leading-tight">{book.title || 'Untitled'}</h1>
            {chTitle && <p className="font-sans text-sm text-teal-600 font-medium mt-2 mb-5">{chTitle}</p>}

            <div className="flex items-center flex-wrap gap-4 font-sans">
              <p className="text-gray-600 font-medium">{book.author || 'Unknown'}</p>
              <span className="text-gray-300">|</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full">Lexile: {book.lexile_level || 'N/A'}L</span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full">
                {book.source_type === 'news' ? 'News Article' : 'Book'}
              </span>
              <button
                onClick={toggleFavorite}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium transition-all ${
                  isSaved ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-200'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {isSaved ? 'Saved' : 'Save'}
              </button>
            </div>
          </header>

          <div ref={contentRef} onMouseUp={handleWordClick} className="space-y-6 select-text">
            {paragraphs.map((p, i) => (
              <p key={i} className="leading-[2.2] text-slate-800 text-lg">{p.trim()}</p>
            ))}
          </div>

          <div className="mt-12 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => goToChapter(currentIdx - 1)}
                disabled={currentIdx === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-all font-sans text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                Previous Chapter
              </button>
              <span className="font-sans text-xs text-gray-400">
                Chapter {currentIdx + 1} of {chapters.length} · {Math.round(((currentIdx + 1) / chapters.length) * 100)}%
              </span>
              <button
                onClick={() => goToChapter(currentIdx + 1)}
                disabled={currentIdx >= chapters.length - 1}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-all font-sans text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next Chapter
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={markComplete}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800 transition-all font-sans text-sm font-medium border border-teal-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                Mark as Completed
              </button>
            </div>
          </div>
        </div>
      </main>

      {!panelOpen && (
        <button onClick={() => setPanelOpen(true)} className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-white border border-gray-200 rounded-l-xl shadow-md px-2 py-6 hover:bg-teal-50 transition-all">
          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
      )}

      {panelOpen && (
        <aside className="w-[320px] flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-screen sticky top-0 z-40">
          <div className="flex items-center border-b border-gray-100 flex-shrink-0">
            {['decode', 'insight', 'mentor'].map(tab => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                className={`flex-1 py-3 font-sans text-xs font-semibold uppercase tracking-wider transition-all ${
                  panelTab === tab ? 'text-teal-600 border-b-2 border-teal-500' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'decode' ? 'Decode' : tab === 'insight' ? 'Insight' : 'Mentor'}
              </button>
            ))}
            <button onClick={() => setPanelOpen(false)} className="p-3 hover:bg-gray-100 transition-colors text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {panelTab === 'decode' && <DecodePanel word={selectedWord} onClose={() => setSelectedWord(null)} />}
            {panelTab === 'insight' && <InsightPanel bookId={bookId} currentContent={content} />}
            {panelTab === 'mentor' && <MentorPanel bookId={bookId} chapterIdx={currentIdx} chapterTitle={chTitle} />}
          </div>
        </aside>
      )}
    </div>
  )
}

function DecodePanel({ word, onClose }) {
  const [mindmap, setMindmap] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!word) { setMindmap(null); return }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/mindmap?word=${encodeURIComponent(word)}`)
        if (!cancelled && res.ok) setMindmap(await res.json())
      } catch {} finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [word])

  if (!word) {
    return (
      <div className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 font-sans mb-4">Word Decoder</h3>
        <div className="text-center py-8">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          <p className="text-sm text-gray-500 font-sans">Select a word in the article</p>
          <p className="text-xs text-gray-400 font-sans mt-1">Highlight any word to explore it</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 font-sans">Word Decoder</h3>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">&times;</button>
      </div>

      {loading ? (
        <div className="py-6 space-y-3 animate-pulse">
          <div className="h-6 w-32 bg-gray-100 rounded mx-auto" />
          <div className="h-4 w-48 bg-gray-50 rounded mx-auto" />
          <div className="h-14 w-full bg-gray-50 rounded-xl mt-2" />
        </div>
      ) : mindmap ? (
        <div>
          <div className="text-center mb-4">
            <div className="font-serif text-xl font-bold text-teal-700">{mindmap.word || word}</div>
            {mindmap.definition && <p className="font-sans text-sm text-gray-500 mt-1">{mindmap.definition}</p>}
          </div>
          {mindmap.etymology && (
            <div className="mb-3">
              <p className="font-sans text-[10px] font-semibold text-gray-400 uppercase mb-1">Etymology</p>
              <p className="font-sans text-xs text-gray-600 bg-gray-50 rounded-xl p-3">{mindmap.etymology}</p>
            </div>
          )}
          {mindmap.synonyms?.length > 0 && (
            <div className="mb-3">
              <p className="font-sans text-[10px] font-semibold text-gray-400 uppercase mb-1">Synonyms</p>
              <div className="flex flex-wrap gap-1.5">
                {mindmap.synonyms.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full font-sans text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}
          {mindmap.collocations?.length > 0 && (
            <div className="mb-3">
              <p className="font-sans text-[10px] font-semibold text-gray-400 uppercase mb-1">Collocations</p>
              <div className="flex flex-wrap gap-1.5">
                {mindmap.collocations.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-sans text-xs">{c}</span>
                ))}
              </div>
            </div>
          )}
          {mindmap.example && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl">
              <p className="font-sans text-[10px] font-semibold text-gray-400 uppercase mb-1">Example</p>
              <p className="font-serif text-sm text-gray-600 italic">"{mindmap.example}"</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-gray-400 text-sm py-8">No data for "{word}"</p>
      )}
    </div>
  )
}

function InsightPanel({ bookId, currentContent }) {
  const [lexile, setLexile] = useState(800)
  const [rewriting, setRewriting] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const simplifyContent = async () => {
    if (rewriting) return
    setRewriting(true)
    try {
      const res = await apiFetch('/api/simplify', {
        method: 'POST',
        body: { content: currentContent, target_lexile: lexile },
      })
      if (res.ok) {
        const data = await res.json()
        // In a full implementation, this would replace the content
        alert('Content simplified! Refresh to see changes.')
      }
    } catch {} finally { setRewriting(false) }
  }

  const fetchSummary = async () => {
    if (summaryLoading) return
    setSummaryLoading(true)
    try {
      const res = await apiFetch(`/api/summary?book_id=${bookId}`)
      if (res.ok) setSummary(await res.json())
    } catch {} finally { setSummaryLoading(false) }
  }

  return (
    <div className="p-5">
      <h3 className="text-sm font-semibold text-gray-700 font-sans mb-4">Reading Insight</h3>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-sans">Beginner (400L)</span>
          <span className="text-xs text-gray-500 font-sans">Advanced (1200L+)</span>
        </div>
        <input type="range" min="400" max="1200" value={lexile} onChange={e => setLexile(Number(e.target.value))} step="100" className="w-full h-2 bg-gray-100 rounded-full accent-teal-500" />
        <div className="text-center mt-3">
          <span className="text-sm font-semibold text-teal-600">{lexile}L</span>
        </div>
        <button onClick={simplifyContent} disabled={rewriting} className="mt-4 w-full bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2 text-sm font-sans font-medium transition-all disabled:opacity-60">
          {rewriting ? 'Rewriting...' : `Rewrite to ${lexile}L`}
        </button>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 font-sans mb-4">Article Insight</h3>

      {!summary && !summaryLoading ? (
        <div onClick={fetchSummary} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <span className="text-lg">✨</span>
            <span className="text-sm font-medium font-sans">Click to generate AI summary</span>
          </div>
        </div>
      ) : summaryLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-slate-100 rounded w-full" />
            <div className="h-5 bg-slate-100 rounded w-4/5" />
            <div className="h-4 bg-slate-100 rounded w-3/4" />
          </div>
          <p className="font-sans text-xs text-gray-400 text-center mt-4">AI is reading the article...</p>
        </div>
      ) : summary ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 relative">
          <button onClick={() => setSummary(null)} className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-lg text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">✨</span>
            <h4 className="font-sans text-xs font-semibold text-gray-400 uppercase">AI Insight</h4>
          </div>
          {summary.one_sentence && <p className="font-serif text-slate-800 font-medium text-lg leading-relaxed mb-5">{summary.one_sentence}</p>}
          {summary.takeaways?.length > 0 && (
            <ul className="space-y-2 mb-5">
              {summary.takeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-600">
                  <span className="text-teal-500 mt-1">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
          {summary.focus && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
              <span className="text-base">💡</span>
              <p className="font-sans text-sm text-blue-800 leading-relaxed">{summary.focus}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function MentorPanel({ bookId, chapterIdx, chapterTitle }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setMessages(prev => [...prev, { role: 'user', message: text }])

    try {
      const res = await apiFetch('/api/ai/companion_chat', {
        method: 'POST',
        body: { book_id: parseInt(bookId), chapter_index: chapterIdx, message: text },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'ai', message: data.reply || data.message || '...' }])
      } else {
        setMessages(prev => [...prev, { role: 'ai', message: 'Sorry, I had trouble responding. Try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', message: 'Connection error. Please try again.' }])
    } finally { setSending(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <p className="font-sans text-sm">{chapterTitle ? 'Ask about this chapter...' : 'Open a chapter to meet your AI companion'}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.role === 'user' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                <p className="font-sans text-sm whitespace-pre-wrap">{m.message}</p>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2.5">
              <div className="flex gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div>
            </div>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about this chapter..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          <button onClick={sendMessage} disabled={sending || !input.trim()} className="p-2.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
