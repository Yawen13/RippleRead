import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'

const LENGTH_OPTIONS = [
  { words: 150, label: 'Snippet', hint: '~150 words' },
  { words: 400, label: 'Story', hint: '~400 words' },
  { words: 800, label: 'Novelette', hint: '~800 words' },
]

const KEY_STORAGE_KEY = 'rippleread_weaver_keywords'

export default function Explore() {
  const [keywords, setKeywords] = useState(() => {
    try { return localStorage.getItem(KEY_STORAGE_KEY) || '' }
    catch { return '' }
  })
  const [lexile, setLexile] = useState(750)
  const [wordCount, setWordCount] = useState(400)
  const [generating, setGenerating] = useState(false)
  const [story, setStory] = useState(null)
  const [storyTitle, setStoryTitle] = useState('')
  const [storyChinese, setStoryChinese] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const outputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    try { localStorage.setItem(KEY_STORAGE_KEY, keywords) } catch {}
  }, [keywords])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const parseWords = (text) => text.split(/[,\uFF0C\s]+/).filter(w => w.length > 0)

  const handleGenerate = async (e) => {
    if (generating) return
    const words = parseWords(keywords)
    if (!words.length) { showToast('Please enter at least one word.', 'error'); return }

    setGenerating(true)
    setStory(null)
    setStoryTitle('')
    setStoryChinese('')
    setSaving(false)

    try {
      const res = await apiFetch('/api/explore/weaver', {
        method: 'POST',
        body: { words, target_lexile: lexile, word_count: wordCount },
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Generation failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk

        const titleMatch = fullText.match(/##TITLE:(.*?)##/)
        const title = titleMatch ? titleMatch[1].trim() : ''
        const content = fullText.replace(/##TITLE:.*?##/, '').trim()

        const parts = content.split('---')
        const english = parts[0] || ''
        const chinese = parts[1] || ''

        setStoryTitle(title)
        setStory({ english: english.trim(), chinese: chinese.trim() })
        setStoryChinese(chinese.trim())

        if (outputRef.current) {
          outputRef.current.style.opacity = '1'
          outputRef.current.style.maxHeight = '2000px'
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to generate story', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleConfirm = async () => {
    if (!story || saving) return
    setSaving(true)
    try {
      const title = storyTitle || 'Word Weaver Story'
      const content = story.chinese
        ? `${story.english}\n\n---\n\n${story.chinese}`
        : story.english

      const res = await apiFetch('/api/upload-book', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          source_type: 'weaver',
        }),
      })
      const data = await res.json()
      if (data?.code === 0 && data?.data?.id) {
        showToast('Story saved!')
        navigate(`/reader?id=${data.data.id}`)
      } else {
        showToast(data?.detail || 'Failed to save', 'error')
      }
    } catch { showToast('Failed to save story', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-7 pb-12 max-w-[1440px]">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-800">Explore</h1>
        <p className="text-gray-400 font-sans mt-1">Weave words into stories, discover what awaits</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/60 p-8 max-w-3xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-gray-800">AI Word Weaver</h2>
            <p className="font-sans text-sm text-gray-400 mt-1">Enter a few words you want to learn, and we'll weave them into a story crafted just for your reading level.</p>
          </div>
        </div>

        <textarea
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          rows="2"
          placeholder="Enter words, separated by commas"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
        />

        <div className="mt-4">
          <span className="font-sans text-xs font-medium text-gray-500">Story Length</span>
          <div className="flex gap-2 mt-2">
            {LENGTH_OPTIONS.map(opt => (
              <button
                key={opt.words}
                onClick={() => setWordCount(opt.words)}
                className={`px-4 py-2 rounded-xl font-sans text-sm transition-all ${
                  wordCount === opt.words
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label} <span className={`text-xs ${wordCount === opt.words ? 'text-teal-100' : 'text-gray-400'}`}>{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-medium text-gray-500">Target Lexile</span>
            <span className="font-sans text-sm font-semibold text-teal-600">{lexile}L</span>
          </div>
          <input
            type="range"
            min="200"
            max="1600"
            step="100"
            value={lexile}
            onChange={e => setLexile(parseInt(e.target.value))}
            className="w-full mt-1 accent-teal-500"
          />
          <div className="flex justify-between text-[10px] text-gray-300 font-sans mt-0.5">
            <span>200L</span><span>900L</span><span>1600L</span>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-sans font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-60 relative overflow-hidden"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" /></svg>
              Weaving your story...
            </span>
          ) : 'Generate Story'}
        </button>

        <div ref={outputRef} className="mt-6 opacity-0 max-h-0 overflow-hidden transition-all duration-500">
          {story && (
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              {storyTitle && <h3 className="font-serif text-lg font-bold text-gray-800 mb-3">{storyTitle}</h3>}
              <div className="font-serif text-[0.95rem] leading-relaxed text-gray-700 whitespace-pre-wrap">{story.english}</div>
              {story.chinese && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="font-sans text-xs text-gray-400 mb-2">中文参考</p>
                  <p className="font-sans text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">{story.chinese}</p>
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="px-6 py-2.5 bg-teal-500 text-white font-sans text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save & Read'}
                </button>
                <button
                  onClick={() => { setStory(null); setStoryTitle(''); setStoryChinese('') }}
                  className="px-6 py-2.5 border border-gray-200 text-gray-600 font-sans text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
