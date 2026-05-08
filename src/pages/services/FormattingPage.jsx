import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const IJSR_SECTIONS = ['Title','Authors & Affiliation','Abstract','Keywords','Introduction','Literature Survey','Problem Definition','Methodology / Approach','Results & Discussion','Conclusion','Future Scope','References']

const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:3px}
select option{background:#0d1f3c;color:#fff}

/* Quill overrides */
.ql-container{font-family:'Times New Roman',serif!important;font-size:11pt!important;border:none!important;height:100%}
.ql-editor{min-height:800px;padding:48px 56px!important;line-height:1.85!important;color:#1a1a1a!important;font-family:'Times New Roman',serif!important;font-size:11pt!important}
.ql-editor h1{font-size:14pt;text-align:center;font-weight:700;margin-bottom:.5em}
.ql-editor h2{font-size:11pt;font-weight:700;text-transform:uppercase;margin-bottom:.4em}
.ql-editor h3{font-size:11pt;font-weight:700;margin-bottom:.3em}
.ql-editor p{margin-bottom:.8em}
.ql-toolbar{background:rgba(10,22,40,.95)!important;border:none!important;border-bottom:1px solid rgba(37,99,235,.2)!important;padding:6px 10px!important}
.ql-toolbar .ql-stroke{stroke:rgba(255,255,255,.6)!important}
.ql-toolbar .ql-fill{fill:rgba(255,255,255,.6)!important}
.ql-toolbar .ql-picker-label{color:rgba(255,255,255,.6)!important}
.ql-toolbar button:hover .ql-stroke,.ql-toolbar button.ql-active .ql-stroke{stroke:#3b82f6!important}
.ql-toolbar button:hover .ql-fill,.ql-toolbar button.ql-active .ql-fill{fill:#3b82f6!important}
.ql-toolbar .ql-picker-label:hover,.ql-toolbar .ql-picker-label.ql-active{color:#3b82f6!important}
.ql-toolbar .ql-picker-options{background:#0d1f3c!important;border:1px solid rgba(37,99,235,.3)!important;color:#fff!important}
.ql-toolbar .ql-picker-item{color:rgba(255,255,255,.7)!important}
.ql-toolbar .ql-picker-item:hover{color:#3b82f6!important}
.ql-snow .ql-editor.ql-blank::before{color:#aaa!important;font-style:italic!important;font-family:'Outfit',sans-serif!important;font-size:10pt!important}
`

function ToolBtn({ icon, label, onClick, loading, color='#93c5fd', active }) {
  return (
    <button onClick={onClick} disabled={loading} title={label} style={{
      width:'100%', padding:'.55rem .75rem',
      background: active ? 'rgba(37,99,235,.2)' : 'rgba(255,255,255,.03)',
      border:`1px solid ${active ? 'rgba(37,99,235,.4)' : 'rgba(37,99,235,.15)'}`,
      borderRadius:7, color, fontSize:'.78rem', fontWeight:500,
      cursor:loading?'not-allowed':'pointer', fontFamily:"'Outfit',sans-serif",
      display:'flex', alignItems:'center', gap:'.55rem',
      transition:'all .15s', textAlign:'left', opacity:loading?.6:1,
    }}
    onMouseEnter={e=>{ if(!loading) { e.currentTarget.style.background='rgba(37,99,235,.12)'; e.currentTarget.style.borderColor='rgba(37,99,235,.35)' }}}
    onMouseLeave={e=>{ if(!active) { e.currentTarget.style.background='rgba(255,255,255,.03)'; e.currentTarget.style.borderColor='rgba(37,99,235,.15)' }}}
    >
      {loading
        ? <span style={{width:12,height:12,border:'2px solid rgba(255,255,255,.3)',borderTopColor:color,borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block',flexShrink:0}}/>
        : <span style={{fontSize:'.95rem',flexShrink:0,width:18,textAlign:'center'}}>{icon}</span>
      }
      <span style={{flex:1}}>{label}</span>
    </button>
  )
}

function SectionRow({ label, found }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',borderBottom:'1px solid rgba(37,99,235,.06)'}}>
      <span style={{fontSize:'.72rem',color:found?'#34d399':'rgba(255,255,255,.25)',flexShrink:0}}>{found?'✓':'○'}</span>
      <span style={{fontSize:'.7rem',color:found?'rgba(255,255,255,.7)':'rgba(255,255,255,.3)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span>
    </div>
  )
}

export default function FormattingPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const quillRef = useRef(null)
  const quillInstance = useRef(null)
  const [ready, setReady] = useState(false)
  const [plainText, setPlainText] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [abstractWords, setAbstractWords] = useState(0)
  const [keywords, setKeywords] = useState([])
  const [citations, setCitations] = useState([])
  const [formatScore, setFormatScore] = useState(null)
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState({})

  /* Load Quill */
  useEffect(() => {
    if (document.getElementById('quill-css')) { initQuill(); return }
    const link = document.createElement('link')
    link.id = 'quill-css'
    link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js'
    script.onload = () => setTimeout(initQuill, 200)
    document.head.appendChild(script)
  }, [])

  function initQuill() {
    if (!window.Quill || !quillRef.current || quillInstance.current) return
    const q = new window.Quill(quillRef.current, {
      theme: 'snow',
      placeholder: 'Upload a DOCX/TXT file or paste your manuscript here…',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          [{ font: [] }, { size: ['8pt','9pt','10pt','11pt','12pt','14pt'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ align: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          ['blockquote', 'code-block'],
          ['clean'],
        ]
      }
    })
    q.on('text-change', () => {
      const text = q.getText()
      setPlainText(text)
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length)
      analyseText(text)
    })
    quillInstance.current = q
    setReady(true)
  }

  function analyseText(text) {
    const lower = text.toLowerCase()
    // Abstract words
    const absMatch = text.match(/abstract[\s\S]{0,20}?\n([\s\S]{0,1000}?)(?=\n[A-Z]|\nkeyword|\nintro)/i)
    if (absMatch) setAbstractWords(absMatch[1].trim().split(/\s+/).filter(Boolean).length)
    // Keywords
    const kwMatch = text.match(/keywords?[:\s]+([^\n]+)/i)
    setKeywords(kwMatch ? kwMatch[1].split(/[,;]/).map(k=>k.trim()).filter(Boolean) : [])
    // Citations
    const refs = [...new Set(text.match(/\[\d+\]|\(\w+,?\s*\d{4}\)/g)||[])]
    setCitations(refs.slice(0,20))
    // Format score
    const found = IJSR_SECTIONS.filter(s=>{
      const key = s.toLowerCase().split('/')[0].trim().split(' ').slice(0,2).join(' ')
      return lower.includes(key)
    }).length
    setFormatScore(Math.round((found/IJSR_SECTIONS.length)*100))
  }

  /* Upload file */
  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !quillInstance.current) return
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      if (ext === 'txt') {
        const text = await file.text()
        quillInstance.current.setText(text)
        showToast({title:'Document loaded!',type:'success'})
      } else if (ext === 'docx') {
        if (!window.mammoth) {
          showToast({title:'DOCX parser loading, wait 2s and try again',type:'warning'}); return
        }
        const buf = await file.arrayBuffer()
        const { value } = await window.mammoth.extractRawText({ arrayBuffer: buf })
        quillInstance.current.setText(value)
        showToast({title:'Document loaded!',type:'success'})
      } else {
        showToast({title:'Use DOCX or TXT files',type:'warning'})
      }
    } catch(err) {
      showToast({title:'Upload failed',message:err.message,type:'error'})
    }
    e.target.value = ''
  }

  /* Load mammoth for DOCX */
  useEffect(() => {
    if (!document.getElementById('mammoth')) {
      const s = document.createElement('script')
      s.id = 'mammoth'
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
      document.head.appendChild(s)
    }
  }, [])

  function setLoad(k,v) { setLoading(l=>({...l,[k]:v})) }

  async function aiCall(prompt) {
    if (!plainText.trim()) { showToast({title:'Load a document first',type:'warning'}); return null }
    const { data:{session} } = await supabase.auth.getSession()
    const res = await fetch('/.netlify/functions/format-journal', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({ prompt, text: plainText }),
    })
    if (!res.ok) throw new Error('AI call failed')
    return res.json()
  }

  async function formatIJSR() {
    setLoad('format',true)
    try {
      const data = await aiCall('format_ijsr')
      if (!data) return
      if (data.html && quillInstance.current) {
        quillInstance.current.clipboard.dangerouslyPasteHTML(data.html)
        showToast({title:'Formatted to IJSR!',type:'success'})
      }
      if (data.issues?.length) setIssues(data.issues)
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('format',false) }
  }

  async function checkPlag() {
    setLoad('plag',true)
    try {
      const data = await aiCall('plagiarism')
      if (!data) return
      showToast({title:`${data.flagged?.length||0} plagiarism issues found`,type:'warning'})
      if (data.flagged?.length) setIssues(data.flagged.map(f=>`🔴 ${f.text?.slice(0,60)}… — ${f.reason}`))
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('plag',false) }
  }

  async function getSuggestions() {
    setLoad('suggest',true)
    try {
      const data = await aiCall('suggestions')
      if (!data) return
      if (data.issues) { setIssues(data.issues); showToast({title:`${data.issues.length} suggestions`,type:'info'}) }
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('suggest',false) }
  }

  async function humanise() {
    setLoad('humanise',true)
    try {
      const data = await aiCall('humanise')
      if (!data) return
      if (data.html && quillInstance.current) {
        quillInstance.current.clipboard.dangerouslyPasteHTML(data.html)
        showToast({title:'Humanised!',type:'success'})
      }
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('humanise',false) }
  }

  function download(type) {
    if (!quillInstance.current) return
    const text = quillInstance.current.getText()
    const html = quillInstance.current.root.innerHTML
    if (type === 'txt') {
      const b = new Blob([text],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='manuscript.txt'; a.click()
    } else {
      const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;font-size:11pt;max-width:800px;margin:40px auto;line-height:1.85}h1{text-align:center;font-size:14pt}h2{font-size:11pt;text-transform:uppercase;font-weight:700}p{margin-bottom:.8em}</style></head><body>${html}</body></html>`
      const b = new Blob([full],{type:'text/html'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='manuscript_formatted.html'; a.click()
    }
  }

  const scoreColor = s => s>=80?'#34d399':s>=50?'#fbbf24':'#f87171'

  return (
    <>
      <style>{CSS}</style>
      <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#0a1628',fontFamily:"'Outfit',sans-serif"}}>

        {/* TOPBAR */}
        <header style={{height:52,flexShrink:0,background:'rgba(10,22,40,.97)',borderBottom:'1px solid rgba(37,99,235,.2)',display:'flex',alignItems:'center',padding:'0 1rem',gap:'.75rem',zIndex:100}}>
          <Link to="/dashboard" style={{color:'rgba(255,255,255,.4)',fontSize:'.78rem',textDecoration:'none'}}>← Dashboard</Link>
          <span style={{color:'rgba(255,255,255,.15)'}}>|</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:700,color:'#fff'}}>📐 Journal Formatting Editor</span>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'.6rem'}}>
            {formatScore!==null && (
              <div style={{display:'flex',alignItems:'center',gap:'.4rem',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.2)',borderRadius:6,padding:'3px 10px'}}>
                <span style={{fontSize:'.7rem',color:'rgba(255,255,255,.4)'}}>IJSR</span>
                <span style={{fontSize:'.85rem',fontWeight:700,color:scoreColor(formatScore)}}>{formatScore}%</span>
              </div>
            )}
            <div style={{display:'flex',alignItems:'center',gap:'.4rem',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.2)',borderRadius:6,padding:'3px 10px'}}>
              <span style={{fontSize:'.7rem',color:'rgba(255,255,255,.4)'}}>Words</span>
              <span style={{fontSize:'.85rem',fontWeight:700,color:'#93c5fd'}}>{wordCount.toLocaleString()}</span>
            </div>
            <label style={{padding:'5px 14px',background:'rgba(37,99,235,.18)',border:'1px solid rgba(37,99,235,.35)',borderRadius:7,color:'#93c5fd',fontSize:'.78rem',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'.4rem'}}>
              📄 Upload DOCX / TXT
              <input type="file" accept=".docx,.txt" style={{display:'none'}} onChange={handleFile} />
            </label>
          </div>
        </header>

        {/* 3-COLUMN LAYOUT */}
        <div style={{flex:1,display:'grid',gridTemplateColumns:'210px 1fr 230px',overflow:'hidden',minHeight:0}}>

          {/* LEFT SIDEBAR */}
          <div style={{borderRight:'1px solid rgba(37,99,235,.18)',overflowY:'auto',padding:'1rem',background:'rgba(8,18,35,.6)',display:'flex',flexDirection:'column',gap:'.4rem'}}>

            <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.2rem',padding:'0 2px'}}>📐 Format</div>
            <ToolBtn icon="📐" label="Format to IJSR" onClick={formatIJSR} loading={loading.format} color='#a78bfa' />

            <div style={{height:1,background:'rgba(37,99,235,.12)',margin:'.4rem 0'}}/>
            <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.2rem',padding:'0 2px'}}>🔬 Analysis</div>
            <ToolBtn icon="🔍" label="Plagiarism Check" onClick={checkPlag} loading={loading.plag} color='#fbbf24' />
            <ToolBtn icon="🤖" label="Humanise Text" onClick={humanise} loading={loading.humanise} color='#34d399' />
            <ToolBtn icon="💡" label="Suggestions" onClick={getSuggestions} loading={loading.suggest} color='#60a5fa' />

            <div style={{height:1,background:'rgba(37,99,235,.12)',margin:'.4rem 0'}}/>
            <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.2rem',padding:'0 2px'}}>⬇ Download</div>
            <ToolBtn icon="📝" label="Download TXT" onClick={()=>download('txt')} color='#93c5fd' />
            <ToolBtn icon="🌐" label="Download HTML" onClick={()=>download('html')} color='#93c5fd' />

            {/* Issues list */}
            {issues.length>0 && (
              <>
                <div style={{height:1,background:'rgba(37,99,235,.12)',margin:'.4rem 0'}}/>
                <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',padding:'0 2px'}}>⚠ Issues ({issues.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:4}}>
                  {issues.slice(0,8).map((issue,i)=>(
                    <div key={i} style={{fontSize:'.68rem',color:'rgba(255,255,255,.55)',padding:'.4rem .6rem',background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.18)',borderRadius:6,lineHeight:1.5}}>
                      {typeof issue==='string'?issue:issue.message||JSON.stringify(issue)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* EDITOR */}
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden',background:'#e8e8e0',minHeight:0}}>
            <div ref={quillRef} style={{flex:1,overflowY:'auto',background:'#fff'}} />
            {!ready && (
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center',color:'rgba(0,0,0,.4)',fontFamily:"'Outfit',sans-serif"}}>
                <div style={{width:32,height:32,border:'3px solid rgba(37,99,235,.2)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 8px'}}/>
                Loading editor…
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{borderLeft:'1px solid rgba(37,99,235,.18)',overflowY:'auto',padding:'1rem',background:'rgba(8,18,35,.6)',display:'flex',flexDirection:'column',gap:'.875rem'}}>

            {/* Format score */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(37,99,235,.2)',borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.6rem'}}>Format Score</div>
              {formatScore!==null ? (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'.5rem'}}>
                    <div style={{flex:1,height:7,background:'rgba(255,255,255,.08)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${formatScore}%`,background:scoreColor(formatScore),borderRadius:4,transition:'width .5s'}}/>
                    </div>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',fontWeight:700,color:scoreColor(formatScore)}}>{formatScore}%</span>
                  </div>
                  <div style={{fontSize:'.7rem',color:'rgba(255,255,255,.35)'}}>
                    {formatScore>=80?'✓ Good match to IJSR':formatScore>=50?'⚠ Partial match — click Format':'✗ Format to IJSR first'}
                  </div>
                </>
              ) : <div style={{fontSize:'.72rem',color:'rgba(255,255,255,.3)'}}>Load a document to see score</div>}
            </div>

            {/* Structure checker */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(37,99,235,.2)',borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.6rem'}}>IJSR Structure</div>
              {IJSR_SECTIONS.map(s=>{
                const key = s.toLowerCase().split('/')[0].trim().split(' ').slice(0,2).join(' ')
                const found = plainText.toLowerCase().includes(key)
                return <SectionRow key={s} label={s} found={found} />
              })}
            </div>

            {/* Abstract */}
            <div style={{background:'rgba(255,255,255,.04)',border:`1px solid ${abstractWords>200?'rgba(239,68,68,.3)':'rgba(37,99,235,.2)'}`,borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.5rem'}}>Abstract</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.3rem'}}>
                <span style={{fontSize:'.75rem',color:'rgba(255,255,255,.45)'}}>Word count</span>
                <span style={{fontSize:'.85rem',fontWeight:700,color:abstractWords>200?'#f87171':'#34d399'}}>{abstractWords} / 200</span>
              </div>
              <div style={{height:4,background:'rgba(255,255,255,.07)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min((abstractWords/200)*100,100)}%`,background:abstractWords>200?'#f87171':'#34d399',borderRadius:2,transition:'width .3s'}}/>
              </div>
              {abstractWords>200&&<div style={{fontSize:'.68rem',color:'#f87171',marginTop:'.3rem'}}>⚠ {abstractWords-200} words over limit</div>}
            </div>

            {/* Keywords */}
            <div style={{background:'rgba(255,255,255,.04)',border:`1px solid ${keywords.length>5?'rgba(239,68,68,.3)':'rgba(37,99,235,.2)'}`,borderRadius:9,padding:'.875rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}>
                <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)'}}>Keywords</div>
                <span style={{fontSize:'.72rem',fontWeight:700,color:keywords.length>5?'#f87171':keywords.length===0?'rgba(255,255,255,.3)':'#34d399'}}>{keywords.length}/5</span>
              </div>
              {keywords.length>0
                ? <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {keywords.map((k,i)=><span key={i} style={{fontSize:'.68rem',background:'rgba(37,99,235,.15)',color:'#93c5fd',padding:'2px 7px',borderRadius:100,border:'1px solid rgba(37,99,235,.25)'}}>{k}</span>)}
                  </div>
                : <div style={{fontSize:'.72rem',color:'rgba(255,255,255,.3)'}}>No keywords detected yet</div>
              }
            </div>

            {/* Citations */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(37,99,235,.2)',borderRadius:9,padding:'.875rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.5rem'}}>
                <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)'}}>Citations</div>
                <span style={{fontSize:'.72rem',fontWeight:700,color:'#93c5fd'}}>{citations.length}</span>
              </div>
              {citations.length>0
                ? <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {citations.slice(0,8).map((c,i)=><div key={i} style={{fontSize:'.68rem',color:'rgba(255,255,255,.5)',fontFamily:"monospace",background:'rgba(255,255,255,.04)',padding:'2px 6px',borderRadius:4}}>{c}</div>)}
                    {citations.length>8&&<div style={{fontSize:'.65rem',color:'rgba(255,255,255,.3)'}}>+{citations.length-8} more</div>}
                  </div>
                : <div style={{fontSize:'.72rem',color:'rgba(255,255,255,.3)'}}>No citations detected</div>
              }
            </div>

            {/* IJSR quick rules */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(37,99,235,.2)',borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.6rem'}}>IJSR Rules</div>
              {[['Font','Times New Roman 10pt'],['Page','A4 Portrait'],['Abstract','Max 200 words'],['Keywords','Max 5'],['Title','Max 120 chars'],['References','Vancouver/Oxford']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.7rem',marginBottom:'.35rem'}}>
                  <span style={{color:'rgba(255,255,255,.35)'}}>{k}</span>
                  <span style={{color:'rgba(255,255,255,.6)',textAlign:'right',maxWidth:130,fontSize:'.68rem'}}>{v}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
