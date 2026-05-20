import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../api/auth'
import { useState, useRef, useEffect } from 'react'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/news', label: 'News', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { to: '/library', label: 'My Library', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { to: '/books', label: 'Book Library', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  { to: '/explore', label: 'Explore', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { to: '/statistics', label: 'Statistics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { to: '/vocabulary', label: 'Notebook', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
]

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 py-3 px-3 rounded-xl font-medium transition-all font-sans text-sm ${
    isActive
      ? 'bg-teal-50 text-teal-700'
      : 'text-gray-600 hover:bg-gray-50'
  }`

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  const displayName = user?.name || user?.username || 'Explorer'
  const initial = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const navigate = useNavigate()

  return (
    <aside className="w-64 bg-white/95 backdrop-blur-lg border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0 shadow-sm z-50">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 min-h-[68px]">
        <a href="/" className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src="/RippleReadLOGO_1.png" alt="RippleRead" className="w-full h-full object-cover" />
        </a>
        <a href="/" className="font-serif text-xl font-bold text-gray-900 whitespace-nowrap no-underline">RippleRead</a>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-100">
        <div className="p-3 relative">
          <button
            ref={btnRef}
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 hover:bg-gray-50 rounded-xl p-1.5 transition-colors w-full cursor-pointer border-0 bg-transparent"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-semibold">{initial}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-sans text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="font-sans text-xs text-gray-400">RippleRead</p>
            </div>
            <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div ref={menuRef} className="absolute left-3 right-3 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10 max-h-60 overflow-y-auto" style={{ bottom: 'calc(100% + 4px)' }}>
              <button onClick={() => { setMenuOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-sans rounded-lg mx-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Edit Profile
              </button>
              <button onClick={() => { setMenuOpen(false); navigate('/settings') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-sans rounded-lg mx-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                Settings
              </button>
              <div className="my-1 border-t border-gray-100 mx-3" />
              <button onClick={() => { setMenuOpen(false); logout() }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-sans rounded-lg mx-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
