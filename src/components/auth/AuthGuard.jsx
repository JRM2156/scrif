import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  /* Show nothing while session is loading — avoids flash */
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a1628',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid rgba(37,99,235,0.2)',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  /* Not logged in → redirect to /login, remember where they came from */
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
