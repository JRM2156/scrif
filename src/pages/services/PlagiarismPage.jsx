import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const JOURNALS = [
  { label:'Elsevier (15%)',      threshold:15 },
  { label:'Springer Nature (10%)', threshold:10 },
  { label:'LWW / Wolters Kluwer (15%)', threshold:15 },
  { label:'Wiley (15%)',         threshold:15 },
  { label:'PLOS ONE (20%)',      threshold:20 },
  { label:'Nature (10%)',        threshold:10 },
  { label:'JAMA (10%)',          threshold:10 },
  { label:'The Lancet (10%)',    threshold:10 },
]

const G = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:2px}
select option{background:#112240;color:#fff}
.highlight-plagiarism{background:rgba(251,191,36,.25);border-bottom:2px solid #fbbf24;cursor:pointer;border-radius:2px;position:relative}
.highlight-grammar{background:rgba(239,68,68,.2);border-bottom:2px solid #f87171;cursor:pointer;border-radius:2px}
.highlight-plagiarism:hover,.highlight-grammar:hover{opacity:.8}
`

/* ── READ FILE ── */
async function readFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'txt') {
    return new Promise(resolve => {
      const r = new FileReader()
      r.onload = e => resolve(e.target.result)
      r.readAsText(file)
    })
  }

  if (ext === 'docx') {
    // Use mammoth via CDN
    const mammoth = window.mammoth
    if (!mammoth) throw new Error('DOCX parser not loaded yet, try again')
    const buf = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: buf })
    return result.value
  }

  if (ext === 'pdf') {
    const pdfjsLib = window.pdfjsLib
    if (!pdfjsLib) throw new Error('PDF parser not loaded, try again')
    const buf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map(s => s.str).join(' ') + '\n'
    }
    return text
  }

  throw new Error('Unsupported file type. Use DOCX, PDF or TXT.')
}

/* ── TOOLTIP ── */
function Tooltip({ item, onReplace, onDismiss }) {
  if (!item) return null
  return (
    <div style={{
      position:'fixed', zIndex:1000,
      top: item.y + 8, left: Math.min(item.x, window.innerWidth - 320),
      background:'#0d1f3c', border:'1px solid rgba(37,99,235,.4)',
      borderRadius:10, padding:'0.875rem', width:300,
      boxShadow:'0 8px 32px rgba(0,0,0,.6)',
      animation:'fadeUp .2s ease both',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
        <span style={{fontSize:'0.68rem',fontWeight:700,color:item.type==='plagiarism'?'#fbbf24':'#f87171',textTransform:'uppercase',letterSpacing:'0.08em'}}>
          {item.type==='plagiarism'?'⚠️ Plagiarism':'❌ Grammar'}
        </span>
        <button onClick={onDismiss} style={{background:'none',border:'none',color:'rgba(255,255,255,.4)',cursor:'pointer',fontSize:'0.9rem'}}>✕</button>
      </div>
      <div style={{fontSize:'0.78rem',color:'rgba(255,255,255,.5)',marginBottom:'0.75rem',lineHeight:1.5}}>
        {item.reason}
      </div>
      {item.suggestion && (
        <>
          <div style={{fontSize:'0.68rem',color:'rgba(255,255,255,.3)',marginBottom:'0.3rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>Suggestion</div>
          <div style={{fontSize:'0.8rem',color:'#fff',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:6,padding:'0.5rem 0.75rem',marginBottom:'0.65rem',lineHeight:1.5}}>
            {item.suggestion}
          </div>
          <button onClick={()=>onReplace(item)} style={{width:'100%',padding:'0.5rem',background:'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',borderRadius:6,color:'#fff',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
            ✓ Replace
          </button>
        </>
      )}
    </div>
  )
}

/* ── MAIN ── */
export default function PlagiarismPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [file,      setFile]      = useState(null)
  const [rawText,   setRawText]   = useState('')
  const [inputMode, setInputMode] = useState('file')
  const [journal,   setJournal]   = useState(JOURNALS[0])
  const [running,   setRunning]   = useState(false)
  const [step,      setStep]      = useState('')
  const [issues,    setIssues]    = useState([])
  const [docHtml,   setDocHtml]   = useState('')
  const [score,     setScore]     = useState(null)
  const [tooltip,   setTooltip]   = useState(null)
  const [editedText,setEditedText]= useState('')
  const docRef = useRef(null)

  /* Load mammoth + pdfjs once */
  useState(() => {
    if (!window.mammoth) {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
      document.head.appendChild(s)
    }
    if (!window.pdfjsLib) {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' }
      document.head.appendChild(s)
    }
  })

  /* ── Build highlighted HTML ── */
  function buildHtml(text, issueList) {
    let html = text
    // Sort by position descending to avoid offset issues
    const sorted = [...issueList].sort((a,b) => (b.start||0) - (a.start||0))
    sorted.forEach((issue, i) => {
      if (issue.original) {
        const cls = issue.type === 'plagiarism' ? 'highlight-plagiarism' : 'highlight-grammar'
        html = html.replace(
          issue.original,
          `<mark class="${cls}" data-idx="${i}">${issue.original}</mark>`
        )
      }
    })
    // Wrap paragraphs
    html = html.split('\n').filter(l => l.trim()).map(l => `<p style="margin-bottom:0.9rem;line-height:1.8">${l}</p>`).join('')
    return html
  }

  /* ── Run analysis ── */
  async function handleRun() {
    const content = inputMode === 'paste' ? rawText : null
    if (inputMode === 'file' && !file) { showToast({title:'Upload a file first',type:'warning'}); return }
    if (inputMode === 'paste' && !rawText.trim()) { showToast({title:'Paste text first',type:'warning'}); return }

    setRunning(true); setIssues([]); setDocHtml(''); setScore(null); setTooltip(null)

    try {
      let text = content
      if (inputMode === 'file') {
        setStep('Reading document…')
        text = await readFile(file)
      }

      if (!text || text.trim().length < 50) throw new Error('Could not extract text. Try pasting instead.')

      setEditedText(text)
      setStep('Analysing with Groq AI…')

      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/.netlify/functions/check-plagiarism', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` },
        body: JSON.stringify({ text, journal_threshold: journal.threshold }),
      })

      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Analysis failed') }

      const data = await res.json()

      // Combine plagiarism + grammar issues
      const allIssues = [
        ...(data.flagged || []).map(f => ({
          type: 'plagiarism',
          original: f.text,
          reason: f.reason || 'Matches published source',
          suggestion: f.rewrite || null,
          source: f.source_hint || '',
          match_pct: f.match_pct,
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
      setDocHtml(buildHtml(text, allIssues))
      showToast({ title:'Analysis complete!', message:`${data.flagged_count} plagiarism + ${data.grammar?.length||0} grammar issues found.`, type:'success' })

    } catch (err) {
      showToast({ title:'Error', message: err.message, type:'error' })
    } finally {
      setRunning(false); setStep('')
    }
  }

  /* ── Handle highlight click ── */
  function handleDocClick(e) {
    const mark = e.target.closest('mark')
    if (!mark) { setTooltip(null); return }
    const idx = parseInt(mark.dataset.idx)
    const rect = mark.getBoundingClientRect()
    setTooltip({ ...issues[idx], x: rect.left, y: rect.bottom + window.scrollY, idx })
  }

  /* ── Replace ── */
  function handleReplace(item) {
    if (!item.suggestion) return
    const newHtml = docRef.current.innerHTML.replace(
      `<mark class="highlight-${item.type}" data-idx="${item.idx}">${item.original}</mark>`,
      `<span style="background:rgba(16,185,129,.15);border-radius:2px">${item.suggestion}</span>`
    )
    docRef.current.innerHTML = newHtml
    setTooltip(null)
    showToast({ title:'Replaced!', type:'success' })
  }

  /* ── Accept all ── */
  function acceptAll() {
    if (!docRef.current) return
    issues.forEach((item, i) => {
      if (!item.suggestion) return
      const marks = docRef.current.querySelectorAll(`mark[data-idx="${i}"]`)
      marks.forEach(m => {
        const span = document.createElement('span')
        span.style.background = 'rgba(16,185,129,.15)'
        span.style.borderRadius = '2px'
        span.textContent = item.suggestion
        m.replaceWith(span)
      })
    })
    showToast({ title:'All fixes applied!', type:'success' })
  }

  /* ── Download ── */
  function download(withFixes) {
    const content = withFixes
      ? docRef.current?.innerText || editedText
      : editedText
    const blob = new Blob([content], { type:'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = withFixes ? 'manuscript_fixed.txt' : 'manuscript_original.txt'
    a.click()
  }

  const plagCount  = issues.filter(i=>i.type==='plagiarism').length
  const gramCount  = issues.filter(i=>i.type==='grammar').length

  return (
    <>
      <style>{G}</style>
      <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0a1628 0%,#0d1f3c 100%)',paddingTop:60,fontFamily:"'Outfit',sans-serif"}}>

        {/* Topbar */}
        <header style={{position:'fixed',top:0,left:0,right:0,height:60,zIndex:100,background:'rgba(10,22,40,.96)',borderBottom:'1px solid rgba(37,99,235,.2)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'0.75rem'}}>
          <Link to="/dashboard" style={{color:'rgba(255,255,255,.4)',fontSize:'0.8rem',textDecoration:'none'}}>← Dashboard</Link>
          <span style={{color:'rgba(255,255,255,.15)'}}>|</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:700,color:'#fff'}}>🔍 Plagiarism Check & Reduction</span>
          {score && (
            <div style={{marginLeft:'auto',display:'flex',gap:'0.75rem',alignItems:'center'}}>
              <span style={{fontSize:'0.78rem',color:score.overall_score>score.journal_threshold?'#f87171':'#34d399',fontWeight:600}}>
                {score.overall_score}% similarity
              </span>
              <span style={{fontSize:'0.72rem',color:'rgba(255,255,255,.3)'}}>→</span>
              <span style={{fontSize:'0.78rem',color:'#34d399',fontWeight:600}}>{score.projected_score}% after fixes</span>
            </div>
          )}
        </header>

        <div style={{display:'grid',gridTemplateColumns:'340px 1fr',height:'calc(100vh - 60px)'}}>

          {/* ── LEFT ── */}
          <div style={{borderRight:'1px solid rgba(37,99,235,.15)',overflowY:'auto',padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1rem'}}>

            {/* Input toggle */}
            <div style={{display:'flex',gap:0,background:'rgba(255,255,255,.04)',border:'1px solid rgba(37,99,235,.2)',borderRadius:8,padding:3}}>
              {['file','paste'].map(m=>(
                <button key={m} onClick={()=>setInputMode(m)} style={{flex:1,padding:'0.45rem',background:inputMode===m?'rgba(37,99,235,.3)':'transparent',border:inputMode===m?'1px solid rgba(37,99,235,.5)':'1px solid transparent',borderRadius:6,color:inputMode===m?'#fff':'rgba(255,255,255,.4)',fontSize:'0.78rem',fontWeight:inputMode===m?600:400,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'all .2s'}}>
                  {m==='file'?'📄 Upload File':'📋 Paste Text'}
                </button>
              ))}
            </div>

            {/* Upload / Paste */}
            {inputMode==='file' ? (
              <div
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)setFile(f)}}
                onClick={()=>document.getElementById('pf').click()}
                style={{border:'2px dashed rgba(37,99,235,.25)',borderRadius:10,padding:'1.75rem',textAlign:'center',cursor:'pointer',background:'rgba(37,99,235,.03)',transition:'all .2s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(37,99,235,.5)';e.currentTarget.style.background='rgba(37,99,235,.07)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(37,99,235,.25)';e.currentTarget.style.background='rgba(37,99,235,.03)'}}
              >
                <input id="pf" type="file" accept=".docx,.pdf,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f)}} />
                {file ? (
                  <div>
                    <div style={{fontSize:'1.75rem',marginBottom:'0.3rem'}}>📄</div>
                    <div style={{fontSize:'0.85rem',fontWeight:600,color:'#fff'}}>{file.name}</div>
                    <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,.3)',marginTop:'0.2rem'}}>{(file.size/1048576).toFixed(2)} MB · click to change</div>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:'1.75rem',marginBottom:'0.4rem'}}>📄</div>
                    <div style={{fontSize:'0.85rem',color:'rgba(255,255,255,.45)'}}>Drop file or <span style={{color:'#3b82f6',fontWeight:600}}>browse</span></div>
                    <div style={{fontSize:'0.68rem',color:'rgba(255,255,255,.25)',marginTop:'0.2rem'}}>DOCX · PDF · TXT</div>
                  </div>
                )}
              </div>
            ) : (
              <textarea value={rawText} onChange={e=>setRawText(e.target.value)} placeholder="Paste your manuscript text here…" rows={8} style={{width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.25)',borderRadius:8,padding:'0.75rem',color:'#fff',fontSize:'0.82rem',lineHeight:1.7,resize:'vertical',outline:'none',fontFamily:"'Outfit',sans-serif"}} />
            )}

            {/* Journal */}
            <div>
              <div style={{fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,.35)',marginBottom:'0.4rem'}}>Target Journal</div>
              <select value={journal.label} onChange={e=>setJournal(JOURNALS.find(j=>j.label===e.target.value))} style={{width:'100%',padding:'0.6rem 0.9rem',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.25)',borderRadius:7,color:'#fff',fontSize:'0.82rem',outline:'none',fontFamily:"'Outfit',sans-serif",cursor:'pointer'}}>
                {JOURNALS.map(j=><option key={j.label} value={j.label}>{j.label}</option>)}
              </select>
            </div>

            {/* Run */}
            <button onClick={handleRun} disabled={running} style={{width:'100%',padding:'0.875rem',background:running?'rgba(37,99,235,.4)':'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',borderRadius:9,color:'#fff',fontSize:'0.9rem',fontWeight:700,cursor:running?'not-allowed':'pointer',fontFamily:"'Outfit',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'0.6rem',boxShadow:running?'none':'0 4px 20px rgba(37,99,235,.4)'}}>
              {running
                ? <><span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block'}} />{step}</>
                : '🔍 Run Analysis — 50 credits'
              }
            </button>

            {/* Legend */}
            {docHtml && (
              <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.15)',borderRadius:8,padding:'0.875rem'}}>
                <div style={{fontSize:'0.68rem',fontWeight:600,color:'rgba(255,255,255,.35)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.6rem'}}>Issues Found</div>
                <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                      <span style={{width:12,height:4,background:'#fbbf24',borderRadius:2,display:'inline-block'}} />
                      <span style={{fontSize:'0.78rem',color:'rgba(255,255,255,.5)'}}>Plagiarism</span>
                    </div>
                    <span style={{fontSize:'0.78rem',fontWeight:700,color:'#fbbf24'}}>{plagCount}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                      <span style={{width:12,height:4,background:'#f87171',borderRadius:2,display:'inline-block'}} />
                      <span style={{fontSize:'0.78rem',color:'rgba(255,255,255,.5)'}}>Grammar</span>
                    </div>
                    <span style={{fontSize:'0.78rem',fontWeight:700,color:'#f87171'}}>{gramCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {docHtml && (
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                <button onClick={acceptAll} style={{width:'100%',padding:'0.7rem',background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.3)',borderRadius:8,color:'#34d399',fontSize:'0.82rem',fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                  ✓ Accept All Fixes
                </button>
                <button onClick={()=>download(true)} style={{width:'100%',padding:'0.7rem',background:'rgba(37,99,235,.1)',border:'1px solid rgba(37,99,235,.25)',borderRadius:8,color:'#93c5fd',fontSize:'0.82rem',fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                  ⬇ Download Fixed Version
                </button>
                <button onClick={()=>download(false)} style={{width:'100%',padding:'0.7rem',background:'transparent',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,color:'rgba(255,255,255,.4)',fontSize:'0.82rem',fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                  ⬇ Download Original
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT: Document block ── */}
          <div style={{overflowY:'auto',padding:'1.5rem',position:'relative'}} onClick={()=>setTooltip(null)}>
            {!docHtml && !running && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'1rem',opacity:.4}}>
                <div style={{fontSize:'3rem'}}>📝</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'#fff'}}>Your document will appear here</div>
                <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,.5)'}}>Upload or paste text, then run analysis</div>
              </div>
            )}

            {running && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'1rem'}}>
                <div style={{width:44,height:44,border:'3px solid rgba(37,99,235,.2)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin .8s linear infinite'}} />
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'#fff'}}>{step}</div>
              </div>
            )}

            {docHtml && (
              <div
                ref={docRef}
                contentEditable
                suppressContentEditableWarning
                onClick={handleDocClick}
                dangerouslySetInnerHTML={{__html: docHtml}}
                style={{
                  outline:'none',
                  fontSize:'0.9rem',lineHeight:1.85,color:'rgba(255,255,255,.85)',
                  maxWidth:800,margin:'0 auto',
                  fontFamily:"Georgia, serif",
                  background:'rgba(255,255,255,.02)',
                  border:'1px solid rgba(37,99,235,.12)',
                  borderRadius:12,padding:'2rem',
                  minHeight:'60vh',
                }}
              />
            )}
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div onClick={e=>e.stopPropagation()}>
            <Tooltip item={tooltip} onReplace={handleReplace} onDismiss={()=>setTooltip(null)} />
          </div>
        )}
      </div>
    </>
  )
}
