import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback(({ title, message, type = 'info', duration = 4500 }) => {
    const id = ++_id
    setToasts(t => [...t, { id, title, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastStack toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastStack({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast key={t.id} {...t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  )
}

function Toast({ title, message, type, onRemove }) {
  const colors = {
    info:    { bg: '#112240', border: 'rgba(37,99,235,0.4)',  icon: 'ℹ️' },
    success: { bg: '#052e16', border: 'rgba(16,185,129,0.4)', icon: '✅' },
    error:   { bg: '#1c0505', border: 'rgba(239,68,68,0.4)',  icon: '❌' },
    warning: { bg: '#1c1200', border: 'rgba(245,158,11,0.4)', icon: '⚠️' },
  }
  const c = colors[type] || colors.info

  return (
    <div
      onClick={onRemove}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '10px',
        padding: '0.9rem 1.25rem',
        minWidth: '300px',
        maxWidth: '380px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        animation: 'slideInRight 0.3s ease both',
        pointerEvents: 'auto',
        borderLeft: `3px solid ${c.border.replace('0.4', '0.9')}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{c.icon}</span>
        <div>
          {title && (
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', marginBottom: '0.15rem' }}>
              {title}
            </div>
          )}
          {message && (
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
