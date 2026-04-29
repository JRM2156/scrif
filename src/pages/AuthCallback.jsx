import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    /* Supabase automatically parses the URL hash/query params and
       stores the session. We just wait for it then redirect. */
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth callback error:', error)
        navigate('/login?error=auth_callback_failed', { replace: true })
        return
      }
      if (session) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    })
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.25rem',
      background: '#0a1628',
    }}>
      <div style={{
        width: 48, height: 48,
        border: '3px solid rgba(37,99,235,0.2)',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: '0.95rem',
        color: 'rgba(255,255,255,0.5)',
      }}>
        Signing you in…
      </p>
    </div>
  )
}
