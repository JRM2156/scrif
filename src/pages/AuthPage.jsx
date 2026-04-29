import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { signIn, signUp, signInWithGoogle, signInWithGitHub, resetPassword } from '@/lib/auth'

/* ─────────────────────────────────────────
   STYLES  (scoped inline — no CSS file needed)
───────────────────────────────────────────*/
const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(68px + 2rem) 5% 3rem',
    position: 'relative',
    overflow: 'hidden',
    background: '#0a1628',
  },
  bg: {
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    background: `
      radial-gradient(ellipse 70% 60% at 80% 20%, rgba(37,99,235,0.16) 0%, transparent 60%),
      radial-gradient(ellipse 50% 50% at 15% 80%, rgba(29,78,216,0.1) 0%, transparent 55%),
      linear-gradient(150deg, #0a1628 0%, #0f2d57 60%, #0a1e40 100%)`,
  },
  grid: {
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
    backgroundSize: '60px 60px',
  },
  container: {
    position: 'relative', zIndex: 2,
    width: '100%', maxWidth: 1100,
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(37,99,235,0.25)',
    borderRadius: 20,
    overflow: 'hidden',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 32px 100px rgba(10,22,40,0.5)',
    animation: 'fadeUp 0.6s ease both',
  },
  left: {
    background: 'linear-gradient(155deg, rgba(37,99,235,0.18) 0%, rgba(29,78,216,0.08) 50%, rgba(10,22,40,0.6) 100%)',
    borderRight: '1px solid rgba(37,99,235,0.2)',
    padding: '3.5rem 3rem',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    position: 'relative', overflow: 'hidden',
  },
  right: {
    padding: '3.5rem 3rem',
    display: 'flex', flexDirection: 'column',
    background: 'rgba(10,22,40,0.4)',
    overflowY: 'auto',
    maxHeight: '90vh',
  },
}

/* ─────────────────────────────────────────
   SMALL REUSABLE COMPONENTS
───────────────────────────────────────────*/
function OAuthBtn({ icon, label, onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: '100%', padding: '0.75rem 1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(37,99,235,0.25)',
      borderRadius: 8, color: '#fff',
      fontSize: '0.875rem', fontWeight: 500,
      cursor: loading ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s', opacity: loading ? 0.6 : 1,
      fontFamily: "'Outfit', sans-serif",
    }}
    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.09)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
    >
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      {label}
    </button>
  )
}

function FormGroup({ label, children, error }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block', fontSize: '0.72rem', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem',
      }}>
        {label}
      </label>
      {children}
      {error && (
        <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.3rem' }}>
          {error}
        </div>
      )}
    </div>
  )
}

function TextInput({ type = 'text', placeholder, value, onChange, error, rightEl }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={isPassword && show ? 'text' : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: '100%', padding: '0.7rem 1rem',
          paddingRight: (isPassword || rightEl) ? '2.8rem' : '1rem',
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${error ? '#f87171' : 'rgba(37,99,235,0.25)'}`,
          borderRadius: 8, color: '#fff',
          fontSize: '0.875rem', outline: 'none',
          transition: 'border-color 0.2s',
          fontFamily: "'Outfit', sans-serif",
        }}
        onFocus={e  => e.target.style.borderColor = '#3b82f6'}
        onBlur={e   => e.target.style.borderColor = error ? '#f87171' : 'rgba(37,99,235,0.25)'}
      />
      {isPassword && (
        <button type="button" onClick={() => setShow(s => !s)} style={{
          position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '1rem', color: 'rgba(255,255,255,0.4)', padding: 0,
        }}>
          {show ? '🙈' : '👁'}
        </button>
      )}
    </div>
  )
}

function SelectInput({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange} style={{
      width: '100%', padding: '0.7rem 1rem',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(37,99,235,0.25)',
      borderRadius: 8, color: '#fff',
      fontSize: '0.875rem', outline: 'none',
      fontFamily: "'Outfit', sans-serif",
      cursor: 'pointer',
    }}>
      {children}
    </select>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(37,99,235,0.2)' }} />
      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(37,99,235,0.2)' }} />
    </div>
  )
}

function SubmitBtn({ loading, children, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} style={{
      width: '100%', padding: '0.875rem',
      background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
      border: 'none', borderRadius: 8, color: '#fff',
      fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.02em',
      cursor: loading ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s', marginTop: '1.25rem',
      fontFamily: "'Outfit', sans-serif",
      boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.35)',
    }}
    onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span style={{
            width: 16, height: 16,
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            display: 'inline-block',
          }} />
          {typeof loading === 'string' ? loading : 'Please wait…'}
        </span>
      ) : children}
    </button>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8)  score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  const levels = [
    { pct: '15%', color: '#f87171', text: 'Too weak' },
    { pct: '30%', color: '#fb923c', text: 'Weak' },
    { pct: '55%', color: '#facc15', text: 'Fair' },
    { pct: '78%', color: '#34d399', text: 'Strong' },
    { pct: '100%', color: '#10b981', text: 'Very strong ✓' },
  ]
  const lvl = levels[Math.min(score, 4)]

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: lvl.pct, background: lvl.color,
          borderRadius: 2, transition: 'all 0.3s',
        }} />
      </div>
      <div style={{ fontSize: '0.7rem', color: lvl.color, marginTop: '0.25rem', fontWeight: 500 }}>
        {lvl.text}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   LEFT PANEL
───────────────────────────────────────────*/
function LeftPanel() {
  const stats = [
    { num: '14,200+', lbl: 'Manuscripts processed' },
    { num: '98.4%',   lbl: 'Acceptance rate' },
    { num: '2 hrs',   lbl: 'Avg. turnaround' },
    { num: '100+',    lbl: 'Journals supported' },
  ]
  const features = [
    'AI-powered plagiarism reduction',
    'Journal-specific formatting',
    'Language editing & certification',
    'Cover letter & rebuttal writing',
    'Ethical compliance review',
    '100% confidential — NDA available',
  ]
  return (
    <div style={S.left}>
      {/* Pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0 L40 20 L20 40 L0 20Z' fill='none' stroke='rgba(37,99,235,0.1)' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '40px 40px',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <Link to="/" style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '2rem', fontWeight: 700, color: '#fff',
          textDecoration: 'none', display: 'inline-block', marginBottom: '2.5rem',
          letterSpacing: '-0.01em',
        }}>
          scrif<span style={{ color: '#3b82f6' }}>.</span>com
        </Link>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.35)',
          color: '#bfdbfe', fontSize: '0.7rem', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '0.35rem 0.9rem', borderRadius: 3, marginBottom: '1.25rem',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#3b82f6', animation: 'pulse 2s infinite',
          }} />
          Author Portal
        </div>
        {/* Headline */}
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 700,
          color: '#fff', lineHeight: 1.15, marginBottom: '1rem',
        }}>
          Publish Faster with <em style={{ color: '#3b82f6', fontStyle: 'italic' }}>AI</em>
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.48)', lineHeight: 1.75, marginBottom: '1.75rem' }}>
          Join 14,200+ researchers who trust scrif.com to prepare their manuscripts for publication.
        </p>
        {/* Feature list */}
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {features.map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', color: '#3b82f6',
              }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem',
        position: 'relative', zIndex: 1, marginTop: '2rem',
      }}>
        {stats.map(s => (
          <div key={s.lbl} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(37,99,235,0.2)',
            borderRadius: 10, padding: '1rem',
          }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.7rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>
              {s.num}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.2rem', letterSpacing: '0.04em' }}>
              {s.lbl}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   LOGIN PANEL
───────────────────────────────────────────*/
function LoginPanel({ onSwitch }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { showToast } = useToast()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [errors,   setErrors]   = useState({})
  const [loading,  setLoading]  = useState(false)
  const [oauthLoading, setOauthLoading] = useState('')

  const from = location.state?.from?.pathname || '/dashboard'

  function validate() {
    const e = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email'
    if (!password.trim()) e.password = 'Password is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  async function handleLogin() {
    if (!validate()) return
    setLoading(true)
    const { error } = await signIn({ email, password })
    setLoading(false)
    if (error) {
      showToast({ title: 'Sign in failed', message: error.message, type: 'error' })
      setErrors({ password: error.message })
    } else {
      showToast({ title: 'Welcome back!', message: 'Signed in successfully.', type: 'success' })
      navigate(from, { replace: true })
    }
  }

  async function handleGoogle() {
    setOauthLoading('google')
    const { error } = await signInWithGoogle()
    if (error) {
      showToast({ title: 'Google sign in failed', message: error.message, type: 'error' })
      setOauthLoading('')
    }
    // On success, browser redirects — no need to setLoading(false)
  }

  async function handleGitHub() {
    setOauthLoading('github')
    const { error } = await signInWithGitHub()
    if (error) {
      showToast({ title: 'GitHub sign in failed', message: error.message, type: 'error' })
      setOauthLoading('')
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.9rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
        Welcome back
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.75rem' }}>
        Sign in to your author dashboard
      </p>

      {/* OAuth buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '0.5rem' }}>
        <OAuthBtn
          icon="🇬"
          label="Continue with Google"
          loading={oauthLoading === 'google'}
          onClick={handleGoogle}
        />
        <OAuthBtn
          icon="🐙"
          label="Continue with GitHub"
          loading={oauthLoading === 'github'}
          onClick={handleGitHub}
        />
      </div>

      <Divider label="or sign in with email" />

      {/* Email / password form */}
      <FormGroup label="Email Address" error={errors.email}>
        <TextInput
          type="email"
          placeholder="you@university.edu"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
        />
      </FormGroup>

      <FormGroup label="Password" error={errors.password}>
        <TextInput
          type="password"
          placeholder="Your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
        />
      </FormGroup>

      <div style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
        <ForgotPassword email={email} />
      </div>

      <SubmitBtn loading={loading && 'Signing in…'} onClick={handleLogin}>
        Sign In →
      </SubmitBtn>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)' }}>
        No account?{' '}
        <button onClick={onSwitch} style={{
          background: 'none', border: 'none', color: '#3b82f6',
          cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
          fontFamily: "'Outfit', sans-serif",
        }}>
          Create one free →
        </button>
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD
───────────────────────────────────────────*/
function ForgotPassword({ email }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast({ title: 'Enter your email first', message: 'Type your email above, then click Forgot password.', type: 'warning' })
      return
    }
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      showToast({ title: 'Reset failed', message: error.message, type: 'error' })
    } else {
      showToast({ title: 'Reset link sent!', message: 'Check your inbox for a password reset link.', type: 'success' })
    }
  }

  return (
    <button onClick={handleReset} disabled={loading} style={{
      background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
      fontSize: '0.78rem', cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
    }}>
      {loading ? 'Sending…' : 'Forgot password?'}
    </button>
  )
}

/* ─────────────────────────────────────────
   REGISTER PANEL (3-step)
───────────────────────────────────────────*/
function RegisterPanel({ onSwitch }) {
  const navigate  = useNavigate()
  const { showToast } = useToast()

  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [oauthLoading, setOauthLoading] = useState('')

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', institution: '',
    role: '', specialty: '', country: '',
    password: '', passwordConfirm: '',
    agreeTerms: false,
  })
  const [errors, setErrors] = useState({})

  function set(field) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(f => ({ ...f, [field]: val }))
      setErrors(err => ({ ...err, [field]: '' }))
    }
  }

  function validateStep(s) {
    const e = {}
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = 'Required'
      if (!form.lastName.trim())  e.lastName  = 'Required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required'
      if (!form.institution.trim()) e.institution = 'Required'
    }
    if (s === 2) {
      if (!form.role) e.role = 'Select your role'
    }
    if (s === 3) {
      if (form.password.length < 8) e.password = 'Minimum 8 characters'
      if (form.password !== form.passwordConfirm) e.passwordConfirm = 'Passwords do not match'
      if (!form.agreeTerms) e.agreeTerms = 'You must accept the terms'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  function next() {
    if (validateStep(step)) setStep(s => s + 1)
  }

  async function handleRegister() {
    if (!validateStep(3)) return
    setLoading(true)
    const { error } = await signUp({
      email:       form.email,
      password:    form.password,
      firstName:   form.firstName,
      lastName:    form.lastName,
      institution: form.institution,
      role:        form.role,
    })
    setLoading(false)
    if (error) {
      showToast({ title: 'Registration failed', message: error.message, type: 'error' })
    } else {
      setDone(true)
      showToast({ title: '🎉 Account created!', message: 'Check your inbox to verify your email.', type: 'success' })
    }
  }

  async function handleGoogle() {
    setOauthLoading('google')
    const { error } = await signInWithGoogle()
    if (error) {
      showToast({ title: 'Google sign in failed', message: error.message, type: 'error' })
      setOauthLoading('')
    }
  }

  async function handleGitHub() {
    setOauthLoading('github')
    const { error } = await signInWithGitHub()
    if (error) {
      showToast({ title: 'GitHub sign in failed', message: error.message, type: 'error' })
      setOauthLoading('')
    }
  }

  /* Success screen */
  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
          Verify your email
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: '2rem' }}>
          We sent a verification link to <strong style={{ color: '#3b82f6' }}>{form.email}</strong>.<br />
          Click the link in your inbox to activate your account.
        </p>
        <button onClick={onSwitch} style={{
          padding: '0.75rem 2rem',
          background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
          border: 'none', borderRadius: 8,
          color: '#fff', fontSize: '0.875rem', fontWeight: 600,
          cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
        }}>
          Back to Sign In
        </button>
      </div>
    )
  }

  const stepLabels = ['Personal', 'Research', 'Security']

  return (
    <div>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.9rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
        Create account
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.5rem' }}>
        Join 14,200+ researchers on scrif.com
      </p>

      {/* OAuth — only on step 1 */}
      {step === 1 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <OAuthBtn icon="🇬" label="Sign up with Google" loading={oauthLoading === 'google'} onClick={handleGoogle} />
            <OAuthBtn icon="🐙" label="Sign up with GitHub" loading={oauthLoading === 'github'} onClick={handleGitHub} />
          </div>
          <Divider label="or create with email" />
        </>
      )}

      {/* Step indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {stepLabels.map((label, i) => {
          const n = i + 1
          const isDone   = n < step
          const isActive = n === step
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: i < 2 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: isDone ? '#10b981' : isActive ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  border: `2px solid ${isDone ? '#10b981' : isActive ? '#3b82f6' : 'rgba(37,99,235,0.25)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                  transition: 'all 0.3s',
                }}>
                  {isDone ? '✓' : n}
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isActive ? '#fff' : 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {label}
                </span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: isDone ? '#10b981' : 'rgba(37,99,235,0.2)', transition: 'background 0.3s' }} />}
            </div>
          )
        })}
      </div>

      {/* Step 1 — Personal info */}
      {step === 1 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormGroup label="First Name" error={errors.firstName}>
              <TextInput placeholder="Jane" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
            </FormGroup>
            <FormGroup label="Last Name" error={errors.lastName}>
              <TextInput placeholder="Smith" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
            </FormGroup>
          </div>
          <FormGroup label="Email Address" error={errors.email}>
            <TextInput type="email" placeholder="you@university.edu" value={form.email} onChange={set('email')} error={errors.email} />
          </FormGroup>
          <FormGroup label="Institution / University" error={errors.institution}>
            <TextInput placeholder="Harvard Medical School" value={form.institution} onChange={set('institution')} error={errors.institution} />
          </FormGroup>
          <SubmitBtn onClick={next}>Continue →</SubmitBtn>
        </div>
      )}

      {/* Step 2 — Research profile */}
      {step === 2 && (
        <div>
          <FormGroup label="Your Role" error={errors.role}>
            <SelectInput value={form.role} onChange={set('role')}>
              <option value="">Select your role…</option>
              <option>PhD Student</option>
              <option>Postdoctoral Researcher</option>
              <option>Assistant Professor</option>
              <option>Associate Professor</option>
              <option>Full Professor</option>
              <option>Medical Doctor (MD)</option>
              <option>Resident / Fellow</option>
              <option>Research Scientist</option>
              <option>Independent Researcher</option>
              <option>Other</option>
            </SelectInput>
          </FormGroup>
          <FormGroup label="Research Specialty (optional)">
            <TextInput placeholder="e.g. Cardiology, Machine Learning…" value={form.specialty} onChange={set('specialty')} />
          </FormGroup>
          <FormGroup label="Country (optional)">
            <TextInput placeholder="e.g. India, United States…" value={form.country} onChange={set('country')} />
          </FormGroup>
          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem' }}>
            <button onClick={() => setStep(1)} style={{
              flex: 1, padding: '0.875rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: 8, color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: '0.875rem',
            }}>
              ← Back
            </button>
            <button onClick={next} style={{
              flex: 2, padding: '0.875rem',
              background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
              border: 'none', borderRadius: 8, color: '#fff',
              fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: '0.875rem',
            }}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Password + terms */}
      {step === 3 && (
        <div>
          <FormGroup label="Create Password" error={errors.password}>
            <TextInput type="password" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} error={errors.password} />
            <PasswordStrength password={form.password} />
          </FormGroup>
          <FormGroup label="Confirm Password" error={errors.passwordConfirm}>
            <TextInput type="password" placeholder="Repeat your password" value={form.passwordConfirm} onChange={set('passwordConfirm')} error={errors.passwordConfirm} />
          </FormGroup>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.agreeTerms}
              onChange={set('agreeTerms')}
              style={{ marginTop: '3px', accentColor: '#2563eb', flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              I agree to the{' '}
              <a href="#" style={{ color: '#3b82f6' }}>Terms of Service</a>{' '}
              and{' '}
              <a href="#" style={{ color: '#3b82f6' }}>Privacy Policy</a>.
              Your manuscripts are kept 100% confidential.
            </span>
          </label>
          {errors.agreeTerms && <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.3rem' }}>{errors.agreeTerms}</div>}

          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem' }}>
            <button onClick={() => setStep(2)} style={{
              flex: 1, padding: '0.875rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: 8, color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: '0.875rem',
            }}>
              ← Back
            </button>
            <div style={{ flex: 2 }}>
              <SubmitBtn loading={loading && 'Creating account…'} onClick={handleRegister}>
                🚀 Create My Account
              </SubmitBtn>
            </div>
          </div>
        </div>
      )}

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)' }}>
        Already have an account?{' '}
        <button onClick={onSwitch} style={{
          background: 'none', border: 'none', color: '#3b82f6',
          cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
          fontFamily: "'Outfit', sans-serif",
        }}>
          Sign in →
        </button>
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────
   MAIN AUTH PAGE
───────────────────────────────────────────*/
export default function AuthPage() {
  const { user, loading } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [tab, setTab] = useState('login')

  /* If already logged in, go straight to dashboard */
  useEffect(() => {
    if (!loading && user) {
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }, [user, loading, navigate, location])

  /* Check URL param to open register tab directly */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('tab') === 'register') setTab('register')
  }, [location.search])

  if (loading) return null

  return (
    <>
      {/* CSS keyframes */}
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
        select option { background: #112240; color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(37,99,235,0.3); border-radius: 2px; }
      `}</style>

      <div style={S.bg} />
      <div style={S.grid} />

      <div style={S.page}>
        <div style={S.container}>
          <LeftPanel />

          <div style={S.right}>
            {/* Tab switcher */}
            <div style={{
              display: 'flex', gap: 0,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: 8, padding: '3px',
              marginBottom: '2rem',
            }}>
              {['login', 'register'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '0.55rem',
                  background: tab === t ? 'rgba(37,99,235,0.3)' : 'transparent',
                  border: tab === t ? '1px solid rgba(37,99,235,0.5)' : '1px solid transparent',
                  borderRadius: 6, color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: '0.82rem', fontWeight: tab === t ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: "'Outfit', sans-serif",
                  textTransform: 'capitalize',
                }}>
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {/* Panels */}
            {tab === 'login'
              ? <LoginPanel    onSwitch={() => setTab('register')} />
              : <RegisterPanel onSwitch={() => setTab('login')} />
            }

            {/* Footer links */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '1.5rem',
              marginTop: '2rem', paddingTop: '1.5rem',
              borderTop: '1px solid rgba(37,99,235,0.12)',
              flexWrap: 'wrap',
            }}>
              {['© 2025 scrif.com', 'Privacy Policy', 'Terms of Service'].map(l => (
                <span key={l} style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)' }}>
                  {l.startsWith('©') ? l : <a href="#" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>{l}</a>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
