import { Link } from 'react-router-dom'

export default function PlaceholderPage({ title, description, legacyUrl }) {
  return (
    <div className="p-7 max-w-[1440px]">
      <h1 className="font-serif text-2xl font-bold text-gray-800 mb-2">{title}</h1>
      <p className="text-gray-400 font-sans mb-6">{description || 'This page will be migrated to React soon.'}</p>
      {legacyUrl && (
        <a
          href={legacyUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white text-sm font-sans font-medium rounded-xl hover:bg-teal-600 transition-colors no-underline"
        >
          Open original page
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      )}
    </div>
  )
}
