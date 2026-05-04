import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const LANGUAGES = [
  'Auto-detect','Arabic','Chinese (Simplified)','Chinese (Traditional)',
  'French','German','Hindi','Indonesian','Italian','Japanese',
  'Korean','Malay','Persian','Portuguese','Russian','Spanish',
  'Tamil','Turkish','Urdu','Vietnamese','Other'
]

const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.25);border-radius:3px}
textarea::placeholder{color:rgba(255,255,255,.22)}
select option{background:#0d1f3c;color:#fff}
.gram{background:rgba(251,191,36,.22);border-bottom:2px solid #fbbf24;cursor:pointer;border-radius:2px}
.clarity{background:rgba(96,165,250,.2);border-bottom:2px solid #60a5fa;cursor:pointer;border-radius:2px}
.tone{background:rgba(167,139,250,.2);border-bottom:2px solid #a78bfa;cursor:pointer;border-radius:2px}
.fixed{background:rgba(16,185,129,.15);border-radius:2px}
.issue-card{animation:fadeIn .25s ease both}
`

async function readFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'txt') return new Promise((res,rej) => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsText(file) })
  if (ext === 'docx') {
    if (!window.mammoth) throw new Error('DOCX parser loading, try again in 3 seconds')
    const buf = await file.arrayBuffer()
    const { value } = await window.mammoth.extractRawText({ arrayBuffer: buf })
    return value
  }
  if (ext === 'pdf') {
    if (!window.pdfjsLib) throw new Error('PDF parser loading, try again')
    const buf = await file.arrayBuffer()
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
    let out = ''
    for (let i=1;i<=pdf.numPages;i++) { const p=await pdf.getPage(i); const c=await p.getTextContent(); out+=c.items.map(x=>x.str).join(' ')+'\n' }
    return out
  }
  throw new Error('Use DOCX, PDF or TXT')
}

function useLibs() {
  useEffect(() => {
    if (!document.getElementById('mammoth-js')) {
      const s=document.createElement('script'); s.id='mammoth-js'; s.src='https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'; document.head.appendChild(s)
    }
    if (!document.getElementById('pdfjs')) {
      const s=document.createElement('script'); s.id='pdfjs'; s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}
      document.head.appendChild(s)
    }
  }, [])
}

export default function LanguageEditPage() {
  useLibs()
  const { user } = useAuth()
  const { showToast } = useToast()
  const docRef = useRef(null)

  const [mode,     setMode]     = useState('paste')
  const [file,     setFile]     = useState(null)
  const [paste,    setPaste]    = useState('')
  const [lang,     setLang]     = useState('Auto-detect')
  const [running,  setRunning]  = useState(false)
  const [step,     setStep]     = useState('')
  const [issues,   setIssues]   = useState([])
  const [docHTML,  setDocHTML]  = useState('')
  const [stats,    setStats]    = useState(null)
  const [active,   setActive]   = useState(null) // active issue tooltip

  const gramCount    = issues.filter(i=>i.type==='grammar').length
  const clarityCount = issues.filter(i=>i.type==='clarity').length
  const toneCount    = issues.filter(i=>i.type==='tone').length

  function buildHTML(text, issueList) {
    const paras = text.split('\n').filter(p=>p.trim())
    return paras.map(para => {
      let html = para
      issueList.forEach((issue, idx) => {
        if (!issue.original) return
        const esc = issue.original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
        const cls = issue.type === 'grammar' ? 'gram' : issue.type === 'clarity' ? 'clarity' : 'tone'
        html = html.replace(new RegExp(esc,'g'), `<mark class="${cls}" data-idx="${idx}">${issue.original}</mark>`)
      })
      return `<p style="margin-bottom:1rem;line-height:1.9">${html}</p>`
    }).join('')
  }

  async function run() {
    const content = mode==='paste' ? paste : null
    if (mode==='file' && !file) { showToast({title:'Upload a file first',type:'warning'}); return }
    if (mode==='paste' && !paste.trim()) { showToast({title:'Paste some text first',type:'warning'}); return }

    setRunning(true); setIssues([]); setDocHTML(''); setStats(null); setActive(null)
    if (docRef.current) docRef.current.innerHTML = ''

    try {
      let text = content
      if (mode==='file') { setStep('Reading file…'); text = await readFile(file) }
      if (!text?.trim()) throw new Error('No text found')

      setStep('AI analysing language…')
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/.netlify/functions/language-edit', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({ text, sourceLang: lang }),
      })

      if (!res.ok) { const e=await res.json(); throw new Error(e.error||'Failed') }
      const data = await res.json()

      const allIssues = [
        ...(data.grammar  ||[]).map(i=>({...i,type:'grammar'})),
        ...(data.clarity  ||[]).map(i=>({...i,type:'clarity'})),
        ...(data.tone     ||[]).map(i=>({...i,type:'tone'})),
      ]

      setIssues(allIssues)
      setStats(data.stats)

      const workingText = data.translated || text
      if (docRef.current) docRef.current.innerHTML = buildHTML(workingText, allIssues)

      showToast({title:'Analysis complete!', message:`${allIssues.length} suggestions found`, type:'success'})

    } catch(err) {
      showToast({title:'Error', message:err.message, type:'error'})
    } finally { setRunning(false); setStep('') }
  }

  function onDocClick(e) {
    const mark = e.target.closest('mark')
    if (!mark) { setActive(null); return }
    const idx = parseInt(mark.dataset.idx)
    const rect = mark.getBoundingClientRect()
    setActive({ issue: issues[idx], idx, x: rect.left, y: rect.top - 8 })
  }

  function replace(idx, suggestion) {
    if (!docRef.current || !suggestion) return
    docRef.current.querySelectorAll(`mark[data-idx="${idx}"]`).forEach(m => {
      const span = document.createElement('span')
      span.className = 'fixed'
      span.textContent = suggestion
      m.replaceWith(span)
    })
    setActive(null)
    showToast({title:'Replaced!', type:'success'})
  }

  function acceptAll() {
    if (!docRef.current) return
    issues.forEach((issue,idx) => {
      if (!issue.suggestion) return
      docRef.current.querySelectorAll(`mark[data-idx="${idx}"]`).forEach(m => {
        const span = document.createElement('span')
        span.className = 'fixed'
        span.textContent = issue.suggestion
        m.replaceWith(span)
      })
    })
    setActive(null)
    showToast({title:'All suggestions applied!', type:'success'})
  }

  function download() {
    const text = docRef.current?.innerText || ''
    const blob = new Blob([text], {type:'text/plain'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'manuscript_edited.txt'
    a.click()
  }

  const typeColor = { grammar:'#fbbf24', clarity:'#60a5fa', tone:'#a78bfa' }
  const typeLabel = { grammar:'Grammar', clarity:'Clarity', tone:'Academic Tone' }

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh', display:'flex', flexDirection:'column', background:'#0a1628', fontFamily:"'Outfit',sans-serif"}} onClick={()=>setActive(null)}>

        {/* TOPBAR */}
        <header style={{height:56, flexShrink:0, background:'rgba(10,22,40,.97)', borderBottom:'1px solid rgba(37,99,235,.2)', display:'flex', alignItems:'center', padding:'0 1.5rem', gap:'.75rem', zIndex:100, position:'sticky', top:0}}>
          <Link to="/dashboard" style={{color:'rgba(255,255,255,.4)', fontSize:'.8rem', textDecoration:'none'}}>← Dashboard</Link>
          <span style={{color:'rgba(255,255,255,.15)'}}>|</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', fontWeight:700, color:'#fff'}}>🌐 Language Editing</span>
          {stats && (
            <div style={{marginLeft:'auto', display:'flex', gap:'1rem', alignItems:'center'}}>
              <span style={{fontSize:'.75rem', color:'rgba(255,255,255,.4)'}}>Score:</span>
              <span style={{fontSize:'.85rem', fontWeight:700, color: stats.score>=80?'#34d399':stats.score>=60?'#fbbf24':'#f87171'}}>{stats.score}/100</span>
            </div>
          )}
          {issues.length > 0 && (
            <div style={{display:'flex', gap:'.5rem', marginLeft: stats?'1rem':'auto'}}>
              <button onClick={acceptAll} style={{padding:'.4rem .9rem', background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.3)', borderRadius:7, color:'#34d399', fontSize:'.75rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif"}}>✓ Accept All</button>
              <button onClick={download} style={{padding:'.4rem .9rem', background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.3)', borderRadius:7, color:'#93c5fd', fontSize:'.75rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif"}}>⬇ Download</button>
            </div>
          )}
        </header>

        <div style={{flex:1, padding:'1.5rem', maxWidth:1000, margin:'0 auto', width:'100%'}}>

          {/* TOP: Upload + options */}
          <div style={{background:'rgba(255,255,255,.03)', border:'1px solid rgba(37,99,235,.18)', borderRadius:12, padding:'1.25rem', marginBottom:'1.25rem'}}>

            {/* Mode toggle */}
            <div style={{display:'flex', gap:0, background:'rgba(255,255,255,.04)', border:'1px solid rgba(37,99,235,.2)', borderRadius:8, padding:3, marginBottom:'1rem', width:'fit-content'}}>
              {['paste','file'].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{padding:'.4rem 1rem', background:mode===m?'rgba(37,99,235,.35)':'transparent', border:mode===m?'1px solid rgba(37,99,235,.5)':'1px solid transparent', borderRadius:6, color:mode===m?'#fff':'rgba(255,255,255,.4)', fontSize:'.78rem', fontWeight:mode===m?600:400, cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'all .2s'}}>
                  {m==='paste'?'📋 Paste Text':'📄 Upload File'}
                </button>
              ))}
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 220px 160px', gap:'1rem', alignItems:'end'}}>
              {/* Input */}
              <div>
                {mode==='paste' ? (
                  <textarea value={paste} onChange={e=>setPaste(e.target.value)} placeholder="Paste your manuscript text here — any language…" rows={4} style={{width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(37,99,235,.25)', borderRadius:8, padding:'.7rem .9rem', color:'#fff', fontSize:'.85rem', lineHeight:1.7, resize:'vertical', outline:'none', fontFamily:"'Outfit',sans-serif"}} />
                ) : (
                  <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)setFile(f)}} onClick={()=>document.getElementById('lf').click()} style={{border:'2px dashed rgba(37,99,235,.3)', borderRadius:10, padding:'1.5rem', textAlign:'center', cursor:'pointer', background:'rgba(37,99,235,.03)', transition:'all .2s'}} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(37,99,235,.6)'} onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(37,99,235,.3)'}>
                    <input id="lf" type="file" accept=".docx,.pdf,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f)}} />
                    {file ? <><div style={{fontSize:'1.5rem',marginBottom:'.3rem'}}>📄</div><div style={{fontSize:'.85rem',fontWeight:600,color:'#fff'}}>{file.name}</div><div style={{fontSize:'.7rem',color:'rgba(255,255,255,.3)',marginTop:'.2rem'}}>{(file.size/1048576).toFixed(2)} MB · click to change</div></> : <><div style={{fontSize:'1.5rem',marginBottom:'.4rem'}}>📄</div><div style={{fontSize:'.85rem',color:'rgba(255,255,255,.45)'}}>Drop file or <span style={{color:'#3b82f6',fontWeight:600}}>browse</span></div><div style={{fontSize:'.7rem',color:'rgba(255,255,255,.25)',marginTop:'.2rem'}}>DOCX · PDF · TXT</div></>}
                  </div>
                )}
              </div>

              {/* Language */}
              <div>
                <div style={{fontSize:'.67rem', fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(255,255,255,.35)', marginBottom:'.4rem'}}>Source Language</div>
                <select value={lang} onChange={e=>setLang(e.target.value)} style={{width:'100%', padding:'.6rem .85rem', background:'rgba(255,255,255,.05)', border:'1px solid rgba(37,99,235,.25)', borderRadius:7, color:'#fff', fontSize:'.82rem', outline:'none', fontFamily:"'Outfit',sans-serif", cursor:'pointer'}}>
                  {LANGUAGES.map(l=><option key={l}>{l}</option>)}
                </select>
                <div style={{fontSize:'.68rem', color:'rgba(255,255,255,.3)', marginTop:'.3rem'}}>→ Output: English</div>
              </div>

              {/* Run */}
              <button onClick={run} disabled={running} style={{padding:'.75rem', background:running?'rgba(37,99,235,.35)':'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:9, color:'#fff', fontSize:'.875rem', fontWeight:700, cursor:running?'not-allowed':'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem', boxShadow:running?'none':'0 4px 20px rgba(37,99,235,.4)', height:42}}>
                {running ? <><span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block',flexShrink:0}}/>{step||'Analysing…'}</> : '🌐 Run Edit'}
              </button>
            </div>

            {/* Legend */}
            {issues.length > 0 && (
              <div style={{display:'flex', gap:'1.25rem', marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid rgba(37,99,235,.12)', flexWrap:'wrap'}}>
                {[['grammar',gramCount],['clarity',clarityCount],['tone',toneCount]].map(([type,count])=>(
                  <div key={type} style={{display:'flex', alignItems:'center', gap:'.4rem'}}>
                    <span style={{width:14,height:4,background:typeColor[type],borderRadius:2,display:'inline-block'}}/>
                    <span style={{fontSize:'.75rem', color:'rgba(255,255,255,.5)'}}>{typeLabel[type]}</span>
                    <span style={{fontSize:'.78rem', fontWeight:700, color:typeColor[type]}}>{count}</span>
                  </div>
                ))}
                <span style={{fontSize:'.72rem', color:'rgba(255,255,255,.3)', marginLeft:'auto'}}>Click any highlight to see suggestion</span>
              </div>
            )}
          </div>

          {/* DOCUMENT BLOCK */}
          {!docHTML && !running && (
            <div style={{background:'rgba(255,255,255,.02)', border:'1px solid rgba(37,99,235,.12)', borderRadius:12, padding:'4rem 2rem', textAlign:'center', opacity:.4}}>
              <div style={{fontSize:'3rem', marginBottom:'1rem'}}>📝</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', color:'#fff', marginBottom:'.5rem'}}>Your edited document will appear here</div>
              <div style={{fontSize:'.82rem', color:'rgba(255,255,255,.5)'}}>
                🟡 Grammar &nbsp;·&nbsp; 🔵 Clarity &nbsp;·&nbsp; 🟣 Academic Tone<br/>
                Click any highlight → see suggestion → replace
              </div>
            </div>
          )}

          {running && (
            <div style={{background:'rgba(255,255,255,.02)', border:'1px solid rgba(37,99,235,.12)', borderRadius:12, padding:'4rem 2rem', textAlign:'center'}}>
              <div style={{width:44,height:44,border:'3px solid rgba(37,99,235,.2)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 1rem'}}/>
              <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:'1.3rem', color:'#fff', marginBottom:'.4rem'}}>{step}</div>
              <div style={{fontSize:'.8rem', color:'rgba(255,255,255,.35)'}}>Groq AI reading every sentence</div>
            </div>
          )}

          {docHTML && (
            <div style={{position:'relative'}}>
              {/* Word-style document */}
              <div
                ref={docRef}
                contentEditable
                suppressContentEditableWarning
                onClick={onDocClick}
                style={{
                  outline:'none',
                  background:'#fff',
                  border:'1px solid #ddd',
                  borderRadius:8,
                  padding:'48px 64px',
                  fontSize:'11pt',
                  lineHeight:1.9,
                  color:'#1a1a1a',
                  fontFamily:"Georgia,'Times New Roman',serif",
                  boxShadow:'0 4px 24px rgba(0,0,0,.12)',
                  minHeight:600,
                  cursor:'text',
                }}
              />

              {/* Bottom actions */}
              <div style={{display:'flex', gap:'.75rem', marginTop:'1rem', justifyContent:'flex-end'}}>
                <button onClick={acceptAll} style={{padding:'.65rem 1.5rem', background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.3)', borderRadius:8, color:'#34d399', fontSize:'.82rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif"}}>✓ Accept All Suggestions</button>
                <button onClick={download} style={{padding:'.65rem 1.5rem', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:8, color:'#fff', fontSize:'.82rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 4px 16px rgba(37,99,235,.4)'}}>⬇ Download Edited Document</button>
              </div>
            </div>
          )}
        </div>

        {/* TOOLTIP */}
        {active && (
          <div onClick={e=>e.stopPropagation()} style={{
            position:'fixed',
            top: Math.max(8, active.y - 140),
            left: Math.min(active.x, window.innerWidth - 320),
            zIndex:999, width:310,
            background:'#0d1f3c', border:`1px solid ${typeColor[active.issue.type]}44`,
            borderRadius:10, padding:'1rem',
            boxShadow:'0 8px 32px rgba(0,0,0,.6)',
            animation:'fadeIn .2s ease both',
            borderLeft:`3px solid ${typeColor[active.issue.type]}`,
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.5rem'}}>
              <span style={{fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:typeColor[active.issue.type]}}>
                {active.issue.type === 'grammar' ? '⚠️ Grammar' : active.issue.type === 'clarity' ? '💡 Clarity' : '🎯 Academic Tone'}
              </span>
              <button onClick={()=>setActive(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,.4)',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{fontSize:'.78rem', color:'rgba(255,255,255,.5)', marginBottom:'.75rem', lineHeight:1.55}}>{active.issue.reason}</div>
            {active.issue.suggestion && (
              <>
                <div style={{fontSize:'.67rem', color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'.3rem'}}>Suggested</div>
                <div style={{fontSize:'.82rem', color:'#fff', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:7, padding:'.6rem .75rem', marginBottom:'.65rem', lineHeight:1.6}}>
                  {active.issue.suggestion}
                </div>
                <button onClick={()=>replace(active.idx, active.issue.suggestion)} style={{width:'100%', padding:'.5rem', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:7, color:'#fff', fontSize:'.8rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif"}}>
                  ✓ Replace
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
