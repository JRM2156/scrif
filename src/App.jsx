import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import AuthGuard from './components/auth/AuthGuard'

import AuthPage       from './pages/AuthPage'
import AuthCallback   from './pages/AuthCallback'
import Dashboard      from './pages/Dashboard'
import PlagiarismPage  from './pages/services/PlagiarismPage'
import CoverLetterPage from './pages/services/CoverLetterPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>

            {/* ── Public routes ── */}
            <Route path="/"              element={<Navigate to="/login" replace />} />
            <Route path="/login"         element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* ── Protected routes ── */}
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/dashboard/plagiarism"   element={<AuthGuard><PlagiarismPage /></AuthGuard>} />
            <Route path="/dashboard/cover-letter" element={<AuthGuard><CoverLetterPage /></AuthGuard>} />

            {/* ── Catch-all ── */}
            <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
