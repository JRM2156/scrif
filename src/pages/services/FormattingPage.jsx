import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

/* ── IJSR FORMAT RULES ── */
const IJSR = {
  name: 'IJSR',
  sections: ['Title','Authors & Affiliation','Abstract','Keywords','Introduction','Literature Survey','Problem Definition','Methodology / Approach','Results & Discussion','Conclusion','Future Scope','References'],
  abstractMax: 200,
  keywordsMax: 5,
  titleMax: 120,
  font: 'Times New Roman',
  fontSize: '10pt',
  columns: 'Double (if feasible)',
  margins: { top:'0.7"', bottom:'0.7"', left:'0.67"', right:'0.56"' },
  referenceStyle: 'Vancouver / Oxford',
}

const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:2px}
select option{background:#0d1f3c;color:#fff}
textarea::placeholder{color:rgba(255,255,255,.25)}

/* Editor styles */
.ProseMirror{outline:none;min-height:100%;font-family:'Times New Roman',serif;font-size:10pt;line-height:1.8;color:#1a1a1a;padding:0}
.ProseMirror p{margin-bottom:.75em}
.ProseMirror h1{font-size:14pt;font-weight:700;text-align:center;margin-bottom:.5em;font-family:'Times New Roman',serif}
.ProseMirror h2{font-size:11pt;font-weight:700;margin-bottom:.4em;font-family:'Times New Roman',serif;text-transform:uppercase}
.ProseMirror h3{font-size:10pt;font-weight:700;margin-bottom:.3em;font-family:'Times New Roman',serif}
.ProseMirror ul,.ProseMirror ol{padding-left:1.5em;margin-bottom:.75em}
.ProseMirror blockquote{border-left:3px solid #ccc;padding-left:1em;color:#555;margin:.5em 0}
.ProseMirror .highlight-plag{background:rgba(251,191,36,.3);border-bottom:2px solid #fbbf24}
.ProseMirror .highlight-suggest{background:rgba(96,165,250,.2);border-bottom:2px solid #60a5fa}
.ProseMirror [data-placeholder]::before{content:attr(data-placeholder);color:#aaa;pointer-events:none;position:absolute}
`

/* ── LOAD LIBS ── */
function useLibs(onReady) {
  useEffect(() => {
    const libs = [
      { id:'tiptap-core',    src:'https://cdn.jsdelivr.net/npm/@tiptap/core@2.1.13/dist/index.umd.min.js' },
      { id:'tiptap-pm',      src:'https://cdn.jsdelivr.net/npm/prosemirror-state@1.4.3/dist/index.js' },
      { id:'tiptap-starter', src:'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.1.13/dist/index.umd.min.js' },
      { id:'mammoth',        src:'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js' },
    ]
    let loaded = 0
    libs.forEach(({ id, src }) => {
      if (document.getElementById(id)) { loaded++; if (loaded === libs.length) onReady?.(); return }
      const s = document.createElement('script')
      s.id = id; s.src = src
      s.onload = () => { loaded++; if (loaded === libs.length) onReady?.() }
      document.head.appendChild(s)
    })
  }, [])
}

/* ── TOOLBAR BUTTON ── */
function TBtn({ icon, label, active, onClick, disabled }) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:'4px 8px', background:active?'rgba(37,99,235,.3)':'transparent',
        border:active?'1px solid rgba(37,99,235,.5)':'1px solid transparent',
        borderRadius:5, color:active?'#93c5fd':'rgba(255,255,255,.6)',
        fontSize:'.8rem', cursor:disabled?'not-allowed':'pointer',
        fontFamily:"'Outfit',sans-serif", transition:'all .15s', minWidth:28,
        opacity:disabled?.5:1,
      }}
      onMouseEnter={e=>{ if(!disabled&&!active) e.currentTarget.style.background='rgba(255,255,255,.08)' }}
      onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='transparent' }}
    >
      {icon}
    </button>
  )
}

/* ── LEFT TOOL BUTTON ── */
function ToolBtn({ icon, label, onClick, loading, color='#93c5fd' }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width:'100%', padding:'.6rem .75rem', background:'rgba(255,255,255,.03)',
      border:'1px solid rgba(37,99,235,.2)', borderRadius:8,
      color, fontSize:'.8rem', fontWeight:500, cursor:loading?'not-allowed':'pointer',
      fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', gap:'.6rem',
      transition:'all .2s', textAlign:'left', opacity:loading?.6:1,
    }}
    onMouseEnter={e=>{ if(!loading) e.currentTarget.style.background='rgba(37,99,235,.1)' }}
    onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.03)' }}
    >
      {loading
        ? <span style={{width:12,height:12,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block',flexShrink:0}}/>
        : <span style={{fontSize:'1rem',flexShrink:0}}>{icon}</span>
      }
      {label}
    </button>
  )
}

/* ── SECTION CHECK ── */
function SectionCheck({ content }) {
  const text = content?.toLowerCase() || ''
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      {IJSR.sections.map(s => {
        const key = s.toLowerCase().split('/')[0].trim().split(' ').slice(0,2).join(' ')
        const found = text.includes(key.toLowerCase())
        return (
          <div key={s} style={{display:'flex',alignItems:'center',gap:6,fontSize:'.72rem',color:found?'#34d399':'rgba(255,255,255,.35)'}}>
            <span>{found?'✓':'○'}</span>
            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── MAIN PAGE ── */
export default function FormattingPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const editorRef = useRef(null)
  const editorInstanceRef = useRef(null)
  const [libsReady, setLibsReady] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const [content, setContent] = useState('')
  const [plainText, setPlainText] = useState('')
  const [loading, setLoading] = useState({})
  const [wordCount, setWordCount] = useState(0)
  const [abstractWords, setAbstractWords] = useState(0)
  const [keywords, setKeywords] = useState([])
  const [formatScore, setFormatScore] = useState(null)
  const [issues, setIssues] = useState([])
  const [citations, setCitations] = useState([])
  const [activeFormat, setActiveFormat] = useState({})

  useLibs(() => setLibsReady(true))

  /* Init TipTap editor */
  useEffect(() => {
    if (!libsReady || !editorRef.current || editorInstanceRef.current) return
    if (!window.tiptap || !window.StarterKit) return

    setTimeout(() => {
      try {
        const editor = window.tiptap.createEditor({
          element: editorRef.current,
          extensions: [window.StarterKit],
          content: '<p>Upload or paste your manuscript to begin editing…</p>',
          onUpdate: ({ editor }) => {
            const html = editor.getHTML()
            const text = editor.getText()
            setContent(html)
            setPlainText(text)
            setWordCount(text.trim().split(/\s+/).filter(Boolean).length)
            analyseContent(text)
          },
          onSelectionUpdate: ({ editor }) => {
            setActiveFormat({
              bold: editor.isActive('bold'),
              italic: editor.isActive('italic'),
              underline: editor.isActive('underline'),
              h1: editor.isActive('heading', { level: 1 }),
              h2: editor.isActive('heading', { level: 2 }),
              h3: editor.isActive('heading', { level: 3 }),
              bulletList: editor.isActive('bulletList'),
              orderedList: editor.isActive('orderedList'),
            })
          }
        })
        editorInstanceRef.current = editor
        setEditorReady(true)
      } catch(e) { console.error('Editor init failed:', e) }
    }, 500)
  }, [libsReady])

  function analyseContent(text) {
    if (!text) return
    const words = text.trim().split(/\s+/).filter(Boolean)
    // Extract abstract words
    const absMatch = text.match(/abstract[:\s]+([\s\S]{0,1000}?)(?=keywords|introduction|\n\n\n)/i)
    if (absMatch) setAbstractWords(absMatch[1].trim().split(/\s+/).length)
    // Extract keywords
    const kwMatch = text.match(/keywords?[:\s]+([^\n]+)/i)
    if (kwMatch) setKeywords(kwMatch[1].split(/[,;]/).map(k=>k.trim()).filter(Boolean))
    // Extract citations
    const refs = text.match(/\[\d+\]|\(\w+,\s*\d{4}\)/g) || []
    setCitations([...new Set(refs)].slice(0, 20))
    // Calculate format score
    const found = IJSR.sections.filter(s => {
      const key = s.toLowerCase().split('/')[0].trim().split(' ').slice(0,2).join(' ')
      return text.toLowerCase().includes(key)
    }).length
    setFormatScore(Math.round((found / IJSR.sections.length) * 100))
  }

  /* Upload DOCX */
  async function handleUpload(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      let html = ''
      if (ext === 'docx') {
        if (!window.mammoth) { showToast({title:'Parser loading, try again',type:'warning'}); return }
        const buf = await file.arrayBuffer()
        const result = await window.mammoth.convertToHtml({ arrayBuffer: buf })
        html = result.value
      } else if (ext === 'txt') {
        const text = await file.text()
        html = text.split('\n').map(l=>`<p>${l}</p>`).join('')
      } else {
        showToast({title:'Use DOCX or TXT files',type:'warning'}); return
      }
      if (editorInstanceRef.current) {
        editorInstanceRef.current.commands.setContent(html)
        showToast({title:'Document loaded!',type:'success'})
      }
    } catch(e) {
      showToast({title:'Upload failed',message:e.message,type:'error'})
    }
  }

  /* Toolbar actions */
  const cmd = (action, ...args) => {
    const e = editorInstanceRef.current
    if (!e) return
    switch(action) {
      case 'bold': e.chain().focus().toggleBold().run(); break
      case 'italic': e.chain().focus().toggleItalic().run(); break
      case 'strike': e.chain().focus().toggleStrike().run(); break
      case 'h1': e.chain().focus().toggleHeading({level:1}).run(); break
      case 'h2': e.chain().focus().toggleHeading({level:2}).run(); break
      case 'h3': e.chain().focus().toggleHeading({level:3}).run(); break
      case 'bullet': e.chain().focus().toggleBulletList().run(); break
      case 'ordered': e.chain().focus().toggleOrderedList().run(); break
      case 'blockquote': e.chain().focus().toggleBlockquote().run(); break
      case 'undo': e.chain().focus().undo().run(); break
      case 'redo': e.chain().focus().redo().run(); break
      case 'clear': e.chain().focus().clearNodes().unsetAllMarks().run(); break
    }
  }

  /* AI call */
  async function aiCall(prompt, text) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/.netlify/functions/format-journal', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({ prompt, text }),
    })
    if (!res.ok) throw new Error('AI call failed')
    return res.json()
  }

  function setLoad(key, val) { setLoading(l=>({...l,[key]:val})) }

  /* Format to IJSR */
  async function formatIJSR() {
    if (!plainText.trim()) { showToast({title:'Load a document first',type:'warning'}); return }
    setLoad('format', true)
    try {
      const data = await aiCall('format_ijsr', plainText)
      if (editorInstanceRef.current && data.html) {
        editorInstanceRef.current.commands.setContent(data.html)
        showToast({title:'Formatted to IJSR!',type:'success'})
      }
      if (data.issues) setIssues(data.issues)
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('format', false) }
  }

  /* Plagiarism check */
  async function checkPlagiarism() {
    if (!plainText.trim()) { showToast({title:'Load a document first',type:'warning'}); return }
    setLoad('plag', true)
    try {
      const data = await aiCall('plagiarism', plainText)
      if (data.flagged && editorInstanceRef.current) {
        let html = editorInstanceRef.current.getHTML()
        data.flagged.forEach(f => {
          if (f.text) html = html.replace(f.text, `<mark class="highlight-plag" title="${f.reason}">${f.text}</mark>`)
        })
        editorInstanceRef.current.commands.setContent(html)
        showToast({title:`${data.flagged.length} plagiarism issues found`,type:'warning'})
      }
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('plag', false) }
  }

  /* Suggestions */
  async function getSuggestions() {
    if (!plainText.trim()) { showToast({title:'Load a document first',type:'warning'}); return }
    setLoad('suggest', true)
    try {
      const data = await aiCall('suggestions', plainText)
      if (data.issues) { setIssues(data.issues); showToast({title:`${data.issues.length} suggestions found`,type:'info'}) }
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('suggest', false) }
  }

  /* Humanise */
  async function humanise() {
    if (!plainText.trim()) { showToast({title:'Load a document first',type:'warning'}); return }
    setLoad('humanise', true)
    try {
      const data = await aiCall('humanise', plainText)
      if (data.html && editorInstanceRef.current) {
        editorInstanceRef.current.commands.setContent(data.html)
        showToast({title:'Humanised!',type:'success'})
      }
    } catch(e) { showToast({title:'Error',message:e.message,type:'error'}) }
    finally { setLoad('humanise', false) }
  }

  /* Download */
  function downloadTXT() {
    const text = editorInstanceRef.current?.getText() || ''
    const blob = new Blob([text],{type:'text/plain'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='formatted_manuscript.txt'; a.click()
  }

  function downloadHTML() {
    const html = editorInstanceRef.current?.getHTML() || ''
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;font-size:10pt;max-width:800px;margin:40px auto;line-height:1.8}h1{text-align:center;font-size:14pt}h2{font-size:11pt;text-transform:uppercase}h3{font-size:10pt}</style></head><body>${html}</body></html>`
    const blob = new Blob([full],{type:'text/html'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='formatted_manuscript.html'; a.click()
  }

  const scoreColor = s => s >= 80 ? '#34d399' : s >= 50 ? '#fbbf24' : '#f87171'

  return (
    <>
      <style>{CSS}</style>
      <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#0a1628',fontFamily:"'Outfit',sans-serif"}}>

        {/* TOPBAR */}
        <header style={{height:52,flexShrink:0,background:'rgba(10,22,40,.97)',borderBottom:'1px solid rgba(37,99,235,.2)',display:'flex',alignItems:'center',padding:'0 1rem',gap:'.75rem',zIndex:100}}>
          <Link to="/dashboard" style={{color:'rgba(255,255,255,.4)',fontSize:'.78rem',textDecoration:'none'}}>← Dashboard</Link>
          <span style={{color:'rgba(255,255,255,.15)'}}>|</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:700,color:'#fff'}}>📐 Journal Formatting Editor</span>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'.5rem'}}>
            {formatScore !== null && (
              <div style={{display:'flex',alignItems:'center',gap:'.4rem',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.2)',borderRadius:6,padding:'3px 10px'}}>
                <span style={{fontSize:'.7rem',color:'rgba(255,255,255,.4)'}}>IJSR Match</span>
                <span style={{fontSize:'.85rem',fontWeight:700,color:scoreColor(formatScore)}}>{formatScore}%</span>
              </div>
            )}
            <div style={{display:'flex',alignItems:'center',gap:'.4rem',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.2)',borderRadius:6,padding:'3px 10px'}}>
              <span style={{fontSize:'.7rem',color:'rgba(255,255,255,.4)'}}>Words</span>
              <span style={{fontSize:'.85rem',fontWeight:700,color:'#93c5fd'}}>{wordCount.toLocaleString()}</span>
            </div>
            <label style={{padding:'4px 12px',background:'rgba(37,99,235,.15)',border:'1px solid rgba(37,99,235,.3)',borderRadius:6,color:'#93c5fd',fontSize:'.75rem',fontWeight:600,cursor:'pointer'}}>
              📄 Upload
              <input type="file" accept=".docx,.txt" style={{display:'none'}} onChange={e=>handleUpload(e.target.files?.[0])} />
            </label>
          </div>
        </header>

        {/* MAIN 3-COLUMN */}
        <div style={{flex:1,display:'grid',gridTemplateColumns:'200px 1fr 220px',overflow:'hidden'}}>

          {/* LEFT SIDEBAR */}
          <div style={{borderRight:'1px solid rgba(37,99,235,.15)',overflowY:'auto',padding:'.875rem .75rem',background:'rgba(255,255,255,.01)',display:'flex',flexDirection:'column',gap:'.5rem'}}>

            <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.22)',marginBottom:'.25rem'}}>Format</div>
            <ToolBtn icon="📐" label="Format to IJSR" onClick={formatIJSR} loading={loading.format} color='#a78bfa' />
            <ToolBtn icon="🔄" label="Fix References" onClick={()=>showToast({title:'Coming soon',type:'info'})} color='#93c5fd' />

            <div style={{height:1,background:'rgba(37,99,235,.1)',margin:'.25rem 0'}}/>
            <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.22)',marginBottom:'.25rem'}}>Analysis</div>
            <ToolBtn icon="🔍" label="Check Plagiarism" onClick={checkPlagiarism} loading={loading.plag} color='#fbbf24' />
            <ToolBtn icon="🤖" label="Humanise Text" onClick={humanise} loading={loading.humanise} color='#34d399' />
            <ToolBtn icon="💡" label="Suggestions" onClick={getSuggestions} loading={loading.suggest} color='#60a5fa' />
            <ToolBtn icon="🌐" label="Language Edit" onClick={()=>showToast({title:'Coming soon',type:'info'})} color='#93c5fd' />

            <div style={{height:1,background:'rgba(37,99,235,.1)',margin:'.25rem 0'}}/>
            <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.22)',marginBottom:'.25rem'}}>Download</div>
            <ToolBtn icon="⬇" label="Download TXT" onClick={downloadTXT} color='#93c5fd' />
            <ToolBtn icon="⬇" label="Download HTML" onClick={downloadHTML} color='#93c5fd' />

            {/* Issues */}
            {issues.length > 0 && (
              <>
                <div style={{height:1,background:'rgba(37,99,235,.1)',margin:'.25rem 0'}}/>
                <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.22)',marginBottom:'.25rem'}}>Issues ({issues.length})</div>
                {issues.slice(0,8).map((issue,i)=>(
                  <div key={i} style={{fontSize:'.7rem',color:'rgba(255,255,255,.5)',padding:'.4rem .5rem',background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.15)',borderRadius:6,lineHeight:1.5}}>
                    {issue.message || issue}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* EDITOR COLUMN */}
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* TOOLBAR */}
            <div style={{flexShrink:0,background:'rgba(10,22,40,.9)',borderBottom:'1px solid rgba(37,99,235,.15)',padding:'4px 8px',display:'flex',alignItems:'center',gap:2,flexWrap:'wrap'}}>
              <TBtn icon="↩" label="Undo" onClick={()=>cmd('undo')} />
              <TBtn icon="↪" label="Redo" onClick={()=>cmd('redo')} />
              <div style={{width:1,height:18,background:'rgba(255,255,255,.15)',margin:'0 4px'}}/>
              <TBtn icon="B" label="Bold" active={activeFormat.bold} onClick={()=>cmd('bold')} />
              <TBtn icon="I" label="Italic" active={activeFormat.italic} onClick={()=>cmd('italic')} />
              <TBtn icon="S̶" label="Strikethrough" active={activeFormat.strike} onClick={()=>cmd('strike')} />
              <div style={{width:1,height:18,background:'rgba(255,255,255,.15)',margin:'0 4px'}}/>
              <TBtn icon="H1" label="Heading 1" active={activeFormat.h1} onClick={()=>cmd('h1')} />
              <TBtn icon="H2" label="Heading 2" active={activeFormat.h2} onClick={()=>cmd('h2')} />
              <TBtn icon="H3" label="Heading 3" active={activeFormat.h3} onClick={()=>cmd('h3')} />
              <div style={{width:1,height:18,background:'rgba(255,255,255,.15)',margin:'0 4px'}}/>
              <TBtn icon="≡" label="Bullet List" active={activeFormat.bulletList} onClick={()=>cmd('bullet')} />
              <TBtn icon="1." label="Ordered List" active={activeFormat.orderedList} onClick={()=>cmd('ordered')} />
              <TBtn icon="❝" label="Blockquote" active={activeFormat.blockquote} onClick={()=>cmd('blockquote')} />
              <div style={{width:1,height:18,background:'rgba(255,255,255,.15)',margin:'0 4px'}}/>
              <TBtn icon="✕" label="Clear Formatting" onClick={()=>cmd('clear')} />
              {!editorReady && <span style={{fontSize:'.7rem',color:'rgba(255,255,255,.3)',marginLeft:8}}>Loading editor…</span>}
              {editorReady && <span style={{fontSize:'.7rem',color:'rgba(16,185,129,.5)',marginLeft:8}}>✓ Ready</span>}
            </div>

            {/* EDITOR */}
            <div style={{flex:1,overflowY:'auto',background:'#f5f5f0',padding:'2rem'}}>
              <div style={{maxWidth:760,margin:'0 auto',background:'#fff',boxShadow:'0 2px 20px rgba(0,0,0,.1)',padding:'48px 56px',minHeight:900,borderRadius:4}}>
                <div ref={editorRef} style={{minHeight:800}} />
              </div>
            </div>

            {/* Paste area */}
            <div style={{flexShrink:0,borderTop:'1px solid rgba(37,99,235,.15)',padding:'.5rem .75rem',background:'rgba(10,22,40,.8)',display:'flex',gap:'.5rem',alignItems:'center'}}>
              <span style={{fontSize:'.72rem',color:'rgba(255,255,255,.35)'}}>💡 Tip: You can also paste text directly into the editor above</span>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{borderLeft:'1px solid rgba(37,99,235,.15)',overflowY:'auto',padding:'.875rem .75rem',background:'rgba(255,255,255,.01)',display:'flex',flexDirection:'column',gap:'1rem'}}>

            {/* Format score */}
            {formatScore !== null && (
              <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.18)',borderRadius:9,padding:'.875rem',animation:'fadeIn .3s ease'}}>
                <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.5rem'}}>Format Score</div>
                <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                  <div style={{flex:1,height:6,background:'rgba(255,255,255,.07)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${formatScore}%`,background:scoreColor(formatScore),borderRadius:3,transition:'width .5s ease'}}/>
                  </div>
                  <span style={{fontSize:'1rem',fontWeight:700,color:scoreColor(formatScore),fontFamily:"'Cormorant Garamond',serif"}}>{formatScore}%</span>
                </div>
              </div>
            )}

            {/* Structure checker */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.18)',borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.6rem'}}>IJSR Structure</div>
              <SectionCheck content={plainText} />
            </div>

            {/* Abstract word count */}
            <div style={{background:'rgba(255,255,255,.03)',border:`1px solid ${abstractWords>200?'rgba(239,68,68,.3)':'rgba(37,99,235,.18)'}`,borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.4rem'}}>Abstract</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'.78rem',color:'rgba(255,255,255,.5)'}}>Word count</span>
                <span style={{fontSize:'.85rem',fontWeight:700,color:abstractWords>200?'#f87171':'#34d399'}}>{abstractWords} / 200</span>
              </div>
              {abstractWords > 200 && <div style={{fontSize:'.68rem',color:'#f87171',marginTop:'.3rem'}}>⚠ Exceeds 200 word limit</div>}
            </div>

            {/* Keywords */}
            <div style={{background:'rgba(255,255,255,.03)',border:`1px solid ${keywords.length>5?'rgba(239,68,68,.3)':'rgba(37,99,235,.18)'}`,borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.5rem'}}>
                Keywords <span style={{color:keywords.length>5?'#f87171':'#34d399'}}>{keywords.length}/5</span>
              </div>
              {keywords.length > 0
                ? <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {keywords.map((k,i)=>(
                      <span key={i} style={{fontSize:'.68rem',background:'rgba(37,99,235,.15)',color:'#93c5fd',padding:'2px 7px',borderRadius:100,border:'1px solid rgba(37,99,235,.25)'}}>{k}</span>
                    ))}
                  </div>
                : <div style={{fontSize:'.72rem',color:'rgba(255,255,255,.3)'}}>No keywords detected</div>
              }
            </div>

            {/* Citations */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.18)',borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.5rem'}}>
                Citations <span style={{color:'#93c5fd'}}>{citations.length}</span>
              </div>
              {citations.length > 0
                ? <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {citations.slice(0,10).map((c,i)=>(
                      <div key={i} style={{fontSize:'.7rem',color:'rgba(255,255,255,.5)',fontFamily:"'DM Mono',monospace",background:'rgba(255,255,255,.03)',padding:'2px 6px',borderRadius:4}}>{c}</div>
                    ))}
                    {citations.length > 10 && <div style={{fontSize:'.68rem',color:'rgba(255,255,255,.3)'}}>+{citations.length-10} more</div>}
                  </div>
                : <div style={{fontSize:'.72rem',color:'rgba(255,255,255,.3)'}}>No citations detected</div>
              }
            </div>

            {/* IJSR rules */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.18)',borderRadius:9,padding:'.875rem'}}>
              <div style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.25)',marginBottom:'.6rem'}}>IJSR Rules</div>
              {[
                ['Font','Times New Roman, 10pt'],
                ['Page','A4 Portrait'],
                ['Abstract','Max 200 words'],
                ['Keywords','Max 5'],
                ['Title','Max 120 chars'],
                ['References','Vancouver / Oxford'],
              ].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:'.7rem',marginBottom:'.3rem'}}>
                  <span style={{color:'rgba(255,255,255,.35)'}}>{k}</span>
                  <span style={{color:'rgba(255,255,255,.6)',textAlign:'right',maxWidth:120}}>{v}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
