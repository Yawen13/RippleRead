import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './api/auth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import News from './pages/News'
import Library from './pages/Library'
import BookLibrary from './pages/BookLibrary'
import Explore from './pages/Explore'
import Statistics from './pages/Statistics'
import Vocabulary from './pages/Vocabulary'
import Reader from './pages/Reader'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="news" element={<News />} />
            <Route path="library" element={<Library />} />
            <Route path="books" element={<BookLibrary />} />
            <Route path="explore" element={<Explore />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="vocabulary" element={<Vocabulary />} />
          </Route>

          <Route path="reader" element={<ProtectedRoute><Reader /></ProtectedRoute>} />

          <Route path="*" element={<ProtectedRoute><Layout /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
