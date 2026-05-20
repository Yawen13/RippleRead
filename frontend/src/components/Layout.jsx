import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 min-h-screen w-full" style={{ background: 'var(--rr-bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
