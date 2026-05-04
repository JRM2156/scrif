import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const JOURNALS = [
  { label:'Elsevier', threshold:15 },
  { label:'Springer Nature', threshold:10 },
  { label:'LWW / Wolters Kluwer', threshold:15 },
  { label:'Wiley', threshold:15 },
  { label:'PLOS ONE', threshold:20 },
  { label:'Nature', threshold:10 },
  { label:'JAMA', threshold:10 },
  { label:'The Lancet', threshold:10 },
]

const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Outfit',sans-serif}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:2px}
select option{background:#0d1f3c;color:#fff}
textarea::placeholder{color:rgba(255,255,255,.25)}
.plag{background:rgba(251,191,36,.3);border-bottom:2px solid #fbbf24;cursor:pointer;border-radius:2px;padding:1px 2px}
.gram{background:rgba(239,68,68,.25);border-bottom:2px solid #f87171;cursor:pointer;border-radius:2px;padding:1px 2px}
.plag:hover,.gram:hover{opacity:.75}
.fixed{background:rgba(16,185,129,.2);border-radius:2px;padding:1px 2px}
`

/* Load external libs */
function useLibs() {
  useEffect(() => {
    if (!document.getElementById('mammoth-js')) {
      const s = document.createElement('script')
      s.id = 'mammoth-js'
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
      document.head.appendChild(s)
    }
    if (!document.getElementById('pdfjs')) {
      const s = document.createElement('script')
      s.id = 'pdfjs'
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      document.head.appendChild(s)
    }
  }, [])
}

/* Extract text from file */
async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'txt') {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => res(e.target.result)
      r.onerror = rej
      r.readAsText(file)
    })
  }
  if (ext === 'docx') {
    if (!window.mammoth) throw new Error('DOCX parser loading, try again in 3 seconds')
    const buf = await file.arrayBuffer()
    const { value } = await window.mammoth.extractRawText({ arrayBuffer: buf })
    return value
  }
  if (ext === 'pdf') {
    if (!window.pdfjsLib) throw new Error('PDF parser loading, try again in 3 seconds')
    const buf = await file.arrayBuffer()
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
    let out = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const c = await page.getTextContent()
      out += c.items.map(x => x.str).join(' ') + '\n'
    }
    return out
  }
  throw new Error('Use DOCX, PDF or TXT files')
}

/* Build highlighted HTML from text + issues */
function buildHTML(text, issues) {
  const paragraphs = text.split('\n').filter(p => p.trim().length > 0)
  return paragraphs.map(para => {
    let html = para
    issues.forEach((issue, idx) => {
      if (!issue.original) return
      const escaped = issue.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const cls = issue.type === 'plagiarism' ? 'plag' : 'gram'
      html = html.replace(
        new RegExp(escaped, 'g'),
        `<mark class="${cls}" data-idx="${idx}" title="${issue.reason}">${issue.original}</mark>`
      )
    })
    return `<p style="margin-bottom:1rem;line-height:1.9">${html}</p>`
  }).join('')
}

export default function PlagiarismPage() {
  useLibs()
  const { user } = useAuth()
  const { showToast } = useToast()
  const docRef = useRef(null)

  const [mode,      setMode]      = useState('paste') // 'file' | 'paste'
  const [file,      setFile]      = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [journal,   setJournal]   = useState(JOURNALS[0])
  const [running,   setRunning]   = useState(false)
  const [step,      setStep]      = useState('')
  const [issues,    setIssues]    = useState([])
  const [score,     setScore]     = useState(null)
  const [tooltip,   setTooltip]   = useState(null) // {issue, x, y}
  const [rawText,   setRawText]   = useState('')

  const plagCount = issues.filter(i => i.type === 'plagiarism').length
  const gramCount = issues.filter(i => i.type === 'grammar').length

  /* ── RUN ── */
  async function run() {
    if (mode === 'file' && !file) { showToast({ title:'Upload a file', type:'warning' }); return }
    if (mode === 'paste' && !pasteText.trim()) { showToast({ title:'Paste some text', type:'warning' }); return }

    setRunning(true); setIssues([]); setScore(null); setTooltip(null)
    if (docRef.current) docRef.current.innerHTML = ''

    try {
      let text = pasteText
      if (mode === 'file') {
        setStep('Reading file…')
        text = await extractText(file)
      }
      if (!text.trim()) throw new Error('No text found in file')
      setRawText(text)

      setStep('AI analysing plagiarism…')
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/.netlify/functions/check-plagiarism', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ text, journal_threshold: journal.threshold }),
      })

      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed') }
      const data = await res.json()

      const allIssues = [
        ...(data.flagged || []).map(f => ({
          type: 'plagiarism',
          original: f.text,
          reason: f.reason || 'Matches published source',
          suggestion: f.rewrite || null,
          match_pct: f.match_pct,
          source: f.source_hint,
        })),
        ...(data.grammar || []).map(g => ({
          type: 'grammar',
          original: g.text,
          reason: g.reason || 'Grammar issue',
          suggestion: g.suggestion || null,
        })),
      ]

      setIssues(allIssues)
      setScore(data)

      if (docRef.current) {
        docRef.current.innerHTML = buildHTML(text, allIssues)
      }

      showToast({
        title: 'Analysis complete!',
        message: `${data.flagged_count} plagiarism · ${data.grammar?.length || 0} grammar issues`,
        type: 'success'
      })

    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' })
    } finally {
      setRunning(false); setStep('')
    }
  }

  /* ── CLICK HIGHLIGHT ── */
  function onDocClick(e) {
    const mark = e.target.closest('mark')
    if (!mark) { setTooltip(null); return }
    const idx = parseInt(mark.dataset.idx)
    const rect = mark.getBoundingClientRect()
    setTooltip({ issue: issues[idx], idx, x: rect.left, y: rect.bottom + 8 })
  }

  /* ── REPLACE ── */
  function replace(idx, suggestion) {
    if (!docRef.current || !suggestion) return
    const marks = docRef.current.querySelectorAll(`mark[data-idx="${idx}"]`)
    marks.forEach(m => {
      const span = document.createElement('span')
      span.className = 'fixed'
      span.textContent = suggestion
      m.replaceWith(span)
    })
    setTooltip(null)
    showToast({ title: 'Replaced!', type: 'success' })
  }

  /* ── ACCEPT ALL ── */
  function acceptAll() {
    if (!docRef.current) return
    issues.forEach((issue, idx) => {
      if (!issue.suggestion) return
      docRef.current.querySelectorAll(`mark[data-idx="${idx}"]`).forEach(m => {
        const span = document.createElement('span')
        span.className = 'fixed'
        span.textContent = issue.suggestion
        m.replaceWith(span)
      })
    })
    setTooltip(null)
    showToast({ title: 'All fixes applied!', type: 'success' })
  }

  /* ── DOWNLOAD ── */
  function download(fixed) {
    const text = fixed
      ? (docRef.current?.innerText || rawText)
      : rawText
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fixed ? 'manuscript_fixed.txt' : 'manuscript_original.txt'
    a.click()
  }

  /* ── REWRITE ALL PLAGIARISM ── */
  async function rewriteAll() {
    if (!docRef.current) return
    showToast({ title: 'Rewriting all plagiarism…', type: 'info' })
    issues.forEach((issue, idx) => {
      if (issue.type !== 'plagiarism' || !issue.suggestion) return
      docRef.current.querySelectorAll(`mark[data-idx="${idx}"]`).forEach(m => {
        const span = document.createElement('span')
        span.className = 'fixed'
        span.textContent = issue.suggestion
        m.replaceWith(span)
      })
    })
    showToast({ title: 'Plagiarism rewritten!', type: 'success' })
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#0a1628', fontFamily:"'Outfit',sans-serif" }}>

        {/* TOPBAR */}
        <header style={{ height:56, flexShrink:0, background:'rgba(10,22,40,.97)', borderBottom:'1px solid rgba(37,99,235,.2)', display:'flex', alignItems:'center', padding:'0 1.25rem', gap:'0.75rem', zIndex:100 }}>
          <Link to="/dashboard" style={{ color:'rgba(255,255,255,.45)', fontSize:'0.8rem', textDecoration:'none', display:'flex', alignItems:'center', gap:'0.35rem' }}>
            ← Dashboard
          </Link>
          <span style={{ color:'rgba(255,255,255,.15)' }}>|</span>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', fontWeight:700, color:'#fff' }}>
            🔍 Plagiarism Check & Reduction
          </span>
          {score && (
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'1rem' }}>
              <span style={{ fontSize:'0.78rem', color: score.overall_score > journal.threshold ? '#f87171' : '#34d399', fontWeight:700 }}>
                {score.overall_score}% similarity
              </span>
              <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,.3)' }}>→ {score.projected_score}% after fixes</span>
              <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:100, fontWeight:700,
                background: score.passes_threshold ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                color: score.passes_threshold ? '#34d399' : '#f87171',
                border: `1px solid ${score.passes_threshold ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
              }}>
                {score.passes_threshold ? `✓ Passes ${journal.label}` : `✗ Exceeds ${journal.label} limit`}
              </span>
            </div>
          )}
        </header>

        {/* MAIN */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'320px 1fr', overflow:'hidden' }}>

          {/* LEFT PANEL */}
          <div style={{ borderRight:'1px solid rgba(37,99,235,.15)', overflowY:'auto', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem', background:'rgba(255,255,255,.01)' }}>

            {/* Mode toggle */}
            <div style={{ display:'flex', background:'rgba(255,255,255,.04)', border:'1px solid rgba(37,99,235,.2)', borderRadius:8, padding:3 }}>
              {['paste','file'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:'0.45rem', background:mode===m?'rgba(37,99,235,.35)':'transparent', border:mode===m?'1px solid rgba(37,99,235,.5)':'1px solid transparent', borderRadius:6, color:mode===m?'#fff':'rgba(255,255,255,.4)', fontSize:'0.78rem', fontWeight:mode===m?600:400, cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'all .2s' }}>
                  {m === 'paste' ? '📋 Paste Text' : '📄 Upload File'}
                </button>
              ))}
            </div>

            {/* Paste */}
            {mode === 'paste' && (
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your manuscript text here…"
                rows={10}
                style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(37,99,235,.25)', borderRadius:8, padding:'0.75rem', color:'#fff', fontSize:'0.82rem', lineHeight:1.75, resize:'vertical', outline:'none', fontFamily:"'Outfit',sans-serif" }}
              />
            )}

            {/* Upload */}
            {mode === 'file' && (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f) }}
                onClick={() => document.getElementById('fu').click()}
                style={{ border:'2px dashed rgba(37,99,235,.3)', borderRadius:10, padding:'2rem 1rem', textAlign:'center', cursor:'pointer', background:'rgba(37,99,235,.03)', transition:'all .2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(37,99,235,.6)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(37,99,235,.3)'}
              >
                <input id="fu" type="file" accept=".docx,.pdf,.txt" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
                <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>📄</div>
                {file ? (
                  <>
                    <div style={{ fontSize:'0.85rem', fontWeight:600, color:'#fff' }}>{file.name}</div>
                    <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,.3)', marginTop:'0.2rem' }}>{(file.size/1048576).toFixed(2)} MB · click to change</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,.5)' }}>Drop file or <span style={{ color:'#3b82f6', fontWeight:600 }}>browse</span></div>
                    <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,.25)', marginTop:'0.25rem' }}>DOCX · PDF · TXT</div>
                  </>
                )}
              </div>
            )}

            {/* Journal */}
            <div>
              <div style={{ fontSize:'0.67rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:'0.4rem' }}>Target Journal</div>
              <select value={journal.label} onChange={e => setJournal(JOURNALS.find(j => j.label === e.target.value))} style={{ width:'100%', padding:'0.6rem 0.9rem', background:'rgba(255,255,255,.05)', border:'1px solid rgba(37,99,235,.25)', borderRadius:7, color:'#fff', fontSize:'0.82rem', outline:'none', fontFamily:"'Outfit',sans-serif", cursor:'pointer' }}>
                {JOURNALS.map(j => <option key={j.label} value={j.label}>{j.label} ({j.threshold}% limit)</option>)}
              </select>
            </div>

            {/* Run button */}
            <button onClick={run} disabled={running} style={{ width:'100%', padding:'0.875rem', background:running?'rgba(37,99,235,.35)':'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:9, color:'#fff', fontSize:'0.9rem', fontWeight:700, cursor:running?'not-allowed':'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', boxShadow:running?'none':'0 4px 20px rgba(37,99,235,.4)', transition:'all .2s' }}>
              {running
                ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block', flexShrink:0 }} />{step || 'Analysing…'}</>
                : '🔍 Run Analysis'
              }
            </button>

            {/* Legend & stats */}
            {issues.length > 0 && (
              <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(37,99,235,.15)', borderRadius:9, padding:'0.875rem', animation:'fadeIn .3s ease both' }}>
                <div style={{ fontSize:'0.67rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(255,255,255,.3)', marginBottom:'0.6rem' }}>Issues Found</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <span style={{ width:14, height:4, background:'#fbbf24', borderRadius:2, display:'inline-block' }} />
                      <span style={{ fontSize:'0.78rem', color:'rgba(255,255,255,.5)' }}>Plagiarism</span>
                    </div>
                    <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#fbbf24' }}>{plagCount}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <span style={{ width:14, height:4, background:'#f87171', borderRadius:2, display:'inline-block' }} />
                      <span style={{ fontSize:'0.78rem', color:'rgba(255,255,255,.5)' }}>Grammar</span>
                    </div>
                    <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#f87171' }}>{gramCount}</span>
                  </div>
                </div>
                <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,.3)', lineHeight:1.5 }}>
                  Click any highlighted text to see details and replace
                </div>
              </div>
            )}

            {/* Action buttons */}
            {issues.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', animation:'fadeIn .3s ease both' }}>
                <button onClick={rewriteAll} style={{ width:'100%', padding:'0.7rem', background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.3)', borderRadius:8, color:'#fbbf24', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                  🔄 Rewrite All Plagiarism
                </button>
                <button onClick={acceptAll} style={{ width:'100%', padding:'0.7rem', background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.3)', borderRadius:8, color:'#34d399', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                  ✓ Accept All Fixes
                </button>
                <button onClick={() => download(true)} style={{ width:'100%', padding:'0.7rem', background:'rgba(37,99,235,.1)', border:'1px solid rgba(37,99,235,.25)', borderRadius:8, color:'#93c5fd', fontSize:'0.82rem', fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                  ⬇ Download Fixed Version
                </button>
                <button onClick={() => download(false)} style={{ width:'100%', padding:'0.7rem', background:'transparent', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'rgba(255,255,255,.4)', fontSize:'0.82rem', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                  ⬇ Download Original
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: DOCUMENT BLOCK */}
          <div style={{ overflowY:'auto', padding:'2rem', position:'relative', background:'rgba(255,255,255,.005)' }} onClick={e => { onDocClick(e); if (!e.target.closest('mark')) setTooltip(null) }}>

            {/* Empty state */}
            {!score && !running && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'1rem', opacity:.35, userSelect:'none' }}>
                <div style={{ fontSize:'4rem' }}>📝</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.5rem', color:'#fff' }}>Your document will appear here</div>
                <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,.6)' }}>Paste or upload text, then click Run Analysis</div>
                <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,.4)', marginTop:'0.5rem', textAlign:'center', lineHeight:1.7 }}>
                  🟡 Yellow = plagiarism &nbsp;·&nbsp; 🔴 Red = grammar<br/>
                  Click any highlight to see details and fix
                </div>
              </div>
            )}

            {/* Loading */}
            {running && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'1rem' }}>
                <div style={{ width:48, height:48, border:'3px solid rgba(37,99,235,.2)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.3rem', color:'#fff' }}>{step || 'Analysing…'}</div>
                <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,.35)' }}>Groq AI reading sentence by sentence</div>
              </div>
            )}

            {/* Document */}
            <div
              ref={docRef}
              contentEditable={!!score}
              suppressContentEditableWarning
              onClick={onDocClick}
              style={{
                outline:'none', maxWidth:820, margin:'0 auto',
                fontSize:'0.95rem', lineHeight:1.9, color:'rgba(255,255,255,.88)',
                fontFamily:"Georgia, 'Times New Roman', serif",
                background:'rgba(255,255,255,.025)',
                border: score ? '1px solid rgba(37,99,235,.15)' : 'none',
                borderRadius:12, padding: score ? '2.5rem' : '0',
                minHeight: score ? '60vh' : '0',
                display: score ? 'block' : 'none',
              }}
            />
          </div>
        </div>

        {/* TOOLTIP */}
        {tooltip && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position:'fixed',
              top: Math.min(tooltip.y, window.innerHeight - 220),
              left: Math.min(tooltip.x, window.innerWidth - 310),
              zIndex:999, width:300,
              background:'#0d1f3c', border:'1px solid rgba(37,99,235,.4)',
              borderRadius:10, padding:'1rem',
              boxShadow:'0 8px 32px rgba(0,0,0,.7)',
              animation:'fadeIn .2s ease both',
            }}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.6rem' }}>
              <span style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color: tooltip.issue.type === 'plagiarism' ? '#fbbf24' : '#f87171' }}>
                {tooltip.issue.type === 'plagiarism' ? '⚠️ Plagiarism' : '❌ Grammar'} {tooltip.issue.match_pct ? `· ${tooltip.issue.match_pct}%` : ''}
              </span>
              <button onClick={() => setTooltip(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)', cursor:'pointer', fontSize:'1rem', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,.5)', marginBottom:'0.75rem', lineHeight:1.55 }}>
              {tooltip.issue.reason}
              {tooltip.issue.source && <span style={{ color:'rgba(255,255,255,.3)', display:'block', marginTop:'0.2rem', fontSize:'0.72rem' }}>Source: {tooltip.issue.source}</span>}
            </div>
            {tooltip.issue.suggestion && (
              <>
                <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.3rem' }}>Suggested fix</div>
                <div style={{ fontSize:'0.82rem', color:'#fff', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:7, padding:'0.6rem 0.75rem', marginBottom:'0.75rem', lineHeight:1.6 }}>
                  {tooltip.issue.suggestion}
                </div>
                <button onClick={() => replace(tooltip.idx, tooltip.issue.suggestion)} style={{ width:'100%', padding:'0.55rem', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:7, color:'#fff', fontSize:'0.8rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                  ✓ Replace
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )

  function onDocClick(e) {
    const mark = e.target.closest('mark')
    if (!mark) return
    const idx = parseInt(mark.dataset.idx)
    const rect = mark.getBoundingClientRect()
    setTooltip({ issue: issues[idx], idx, x: rect.left, y: rect.bottom + 8 })
  }
}
