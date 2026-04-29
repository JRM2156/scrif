import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const JOURNALS = [
  { label:'Elsevier — General',       threshold:15 },
  { label:'Springer Nature',          threshold:10 },
  { label:'LWW / Wolters Kluwer',     threshold:15 },
  { label:'Wiley-Blackwell',          threshold:15 },
  { label:'PLOS ONE',                 threshold:20 },
  { label:'Nature Portfolio',         threshold:10 },
  { label:'JAMA Network',             threshold:10 },
  { label:'The Lancet',               threshold:10 },
]

const G = `
@keyframes spin   { to{transform:rotate(360deg)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.25);border-radius:3px}
input::placeholder,textarea::placeholder{color:rgba(255,255,255,.2)}
select option{background:#112240;color:#fff}
`

/* ── HELPERS ── */
const card = (extra={}) => ({
  background:'rgba(255,255,255,.03)',
  border:'1px solid rgba(37,99,235,.18)',
  borderRadius:12,...extra
})

function Label({ children }) {
  return <div style={{fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,.35)',marginBottom:'0.4rem'}}>{children}</div>
}

/* ── SCORE GAUGE ── */
function ScoreGauge({ score, label, color }) {
  const r   = 44
  const circ= 2 * Math.PI * r
  const pct = Math.min(score, 100) / 100
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.3rem'}}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={9} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - circ * pct}
          transform="rotate(-90 55 55)"
          style={{transition:'stroke-dashoffset 1s ease'}}
        />
        <text x={55} y={52} textAnchor="middle" fill={color} fontSize={18} fontWeight={700} fontFamily="Cormorant Garamond, serif">{score}%</text>
        <text x={55} y={66} textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize={9} fontFamily="Outfit, sans-serif">SIMILAR</text>
      </svg>
      <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,.4)',textAlign:'center'}}>{label}</div>
    </div>
  )
}

/* ── LINE ITEM ── */
function LineItem({ line }) {
  const [expanded, setExpanded] = useState(false)
  const colors = { flagged:['rgba(239,68,68,.08)','rgba(239,68,68,.35)','#f87171'], warn:['rgba(245,158,11,.08)','rgba(245,158,11,.3)','#fbbf24'], clean:['rgba(16,185,129,.04)','rgba(16,185,129,.15)','#34d399'] }
  const [bg, border, tc] = colors[line.status] || colors.clean
  return (
    <div style={{borderBottom:'1px solid rgba(37,99,235,.07)',padding:'0.75rem 1.25rem',background:expanded?'rgba(255,255,255,.02)':'transparent',transition:'background .2s'}}>
      <div style={{display:'grid',gridTemplateColumns:'32px 1fr auto',gap:'0.75rem',alignItems:'start',cursor:line.status!=='clean'?'pointer':'default'}} onClick={()=>line.status!=='clean'&&setExpanded(e=>!e)}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',color:'rgba(255,255,255,.3)',paddingTop:2}}>{line.line_num}</span>
        <span style={{fontSize:'0.82rem',lineHeight:1.65,color:'#fff',background:bg,borderRadius:4,padding:line.status!=='clean'?'2px 6px':'0',border:line.status!=='clean'?`1px solid ${border}`:'none'}}>
          {line.text}
        </span>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'3px',flexShrink:0}}>
          <span style={{fontSize:'0.62rem',fontWeight:700,padding:'2px 7px',borderRadius:100,background:bg,color:tc,border:`1px solid ${border}`,whiteSpace:'nowrap'}}>
            {line.status==='flagged'?'FLAGGED':line.status==='warn'?'REVIEW':'CLEAN'}
          </span>
          {line.match_pct > 0 && <span style={{fontSize:'0.62rem',color:'rgba(255,255,255,.3)',fontFamily:"'DM Mono',monospace"}}>{line.match_pct}% match</span>}
        </div>
      </div>
      {expanded && line.reason && (
        <div style={{marginTop:'0.6rem',marginLeft:40,padding:'0.65rem 0.9rem',background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.15)',borderRadius:7,fontSize:'0.75rem',color:'rgba(255,255,255,.5)',lineHeight:1.6}}>
          ⚠️ {line.reason} {line.source && <span style={{color:'#f87171'}}>· Source: {line.source}</span>}
        </div>
      )}
    </div>
  )
}

/* ── REWRITE CARD ── */
function RewriteCard({ item, index, onAccept, onReject, accepted, rejected }) {
  return (
    <div style={{...card({padding:'1.25rem'}),marginBottom:'1rem',opacity:accepted||rejected?.7:1,transition:'opacity .3s'}}>
      <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,.35)',marginBottom:'0.75rem',fontWeight:500}}>
        Sentence {index + 1}
        {item.improvement && <span style={{color:'rgba(255,255,255,.25)',marginLeft:'0.5rem'}}>· {item.improvement}</span>}
      </div>
      {/* Original */}
      <div style={{marginBottom:'0.5rem'}}>
        <div style={{fontSize:'0.62rem',fontWeight:700,color:'#f87171',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'0.3rem',display:'flex',alignItems:'center',gap:'0.4rem'}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'#f87171',display:'inline-block'}} />Original
        </div>
        <div style={{fontSize:'0.82rem',lineHeight:1.7,padding:'0.75rem',background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.15)',borderRadius:7,color:'rgba(255,255,255,.6)',textDecoration:'line-through',textDecorationColor:'rgba(239,68,68,.35)'}}>
          {item.original}
        </div>
      </div>
      {/* Arrow */}
      <div style={{textAlign:'center',fontSize:'0.75rem',color:'rgba(255,255,255,.2)',margin:'0.35rem 0'}}>↓ AI rewritten</div>
      {/* Rewritten */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:'0.62rem',fontWeight:700,color:'#34d399',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'0.3rem',display:'flex',alignItems:'center',gap:'0.4rem'}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'#34d399',display:'inline-block'}} />Rewritten
        </div>
        <div style={{fontSize:'0.82rem',lineHeight:1.7,padding:'0.75rem',background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.18)',borderRadius:7,color:'#fff'}}>
          {item.rewritten}
        </div>
      </div>
      {/* Actions */}
      {!accepted && !rejected ? (
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button onClick={()=>onAccept(index)} style={{flex:1,padding:'0.6rem',background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.3)',borderRadius:7,color:'#34d399',fontSize:'0.8rem',fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>✓ Accept</button>
          <button onClick={()=>onReject(index)} style={{flex:1,padding:'0.6rem',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)',borderRadius:7,color:'rgba(255,255,255,.4)',fontSize:'0.8rem',fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>✗ Keep Original</button>
        </div>
      ) : (
        <div style={{padding:'0.5rem',borderRadius:7,background:accepted?'rgba(16,185,129,.1)':'rgba(255,255,255,.04)',border:`1px solid ${accepted?'rgba(16,185,129,.25)':'rgba(255,255,255,.1)'}`,textAlign:'center',fontSize:'0.78rem',color:accepted?'#34d399':'rgba(255,255,255,.35)',fontWeight:600}}>
          {accepted ? '✓ Rewrite accepted' : '✗ Original kept'}
        </div>
      )}
    </div>
  )
}

/* ── MAIN PAGE ── */
export default function PlagiarismPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [file,       setFile]       = useState(null)
  const [text,       setText]       = useState('')
  const [inputMode,  setInputMode]  = useState('file')
  const [journal,    setJournal]    = useState(JOURNALS[0])
  const [running,    setRunning]    = useState(false)
  const [step,       setStep]       = useState('')
  const [results,    setResults]    = useState(null)
  const [filter,     setFilter]     = useState('all')
  const [decisions,  setDecisions]  = useState({})

  /* ── File read ── */
  async function extractText(f) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.readAsText(f)
    })
  }

  /* ── Run check ── */
  async function handleRun() {
    const content = inputMode === 'paste' ? text : null
    if (inputMode === 'file' && !file) { showToast({title:'Upload a file first',type:'warning'}); return }
    if (inputMode === 'paste' && !text.trim()) { showToast({title:'Paste your text first',type:'warning'}); return }

    setRunning(true)
    setResults(null)
    setDecisions({})

    try {
      // 1. Get text
      let manuscriptText = content
      if (inputMode === 'file') {
        setStep('Reading document…')
        manuscriptText = await extractText(file)
      }

      // 2. Upload file to Supabase Storage
      let fileUrl = null
      if (file) {
        setStep('Uploading manuscript…')
        const ext  = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('manuscripts').upload(path, file)
        if (!upErr) {
          const { data } = supabase.storage.from('manuscripts').getPublicUrl(path)
          fileUrl = data.publicUrl
        }
      }

      // 3. Create manuscript + job records
      setStep('Creating job record…')
      const { data: manuscript } = await supabase
        .from('manuscripts')
        .insert({ user_id: user.id, original_filename: file?.name || 'pasted-text.txt', file_url: fileUrl, target_journal: journal.label, status: 'processing' })
        .select().single()

      const { data: job } = await supabase
        .from('service_jobs')
        .insert({ user_id: user.id, manuscript_id: manuscript?.id, service_type: 'plagiarism', status: 'processing', credits_used: 50 })
        .select().single()

      // 4. Call Netlify function
      setStep('Running AI analysis…')
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/check-plagiarism', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text:              manuscriptText,
          job_id:            job?.id,
          journal_threshold: journal.threshold,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Analysis failed')
      }

      const data = await res.json()
      setResults(data)
      showToast({ title:'Analysis complete!', message:`${data.flagged_count} sentences flagged.`, type:'success' })

    } catch (err) {
      showToast({ title:'Error', message: err.message, type:'error' })
    } finally {
      setRunning(false)
      setStep('')
    }
  }

  /* ── Decisions ── */
  function accept(i) { setDecisions(d => ({...d, [i]: 'accepted'})) }
  function reject(i) { setDecisions(d => ({...d, [i]: 'rejected'})) }

  /* ── Filtered lines ── */
  const filteredLines = results?.lines?.filter(l => {
    if (filter === 'flagged') return l.status !== 'clean'
    return true
  }) || []

  /* ── Score color ── */
  function scoreColor(pct) {
    if (pct <= 10) return '#10b981'
    if (pct <= 20) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <>
      <style>{G}</style>
      <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0a1628 0%,#0d1f3c 60%,#0a1628 100%)',paddingTop:60}}>

        {/* Topbar */}
        <header style={{position:'fixed',top:0,left:0,right:0,height:60,zIndex:100,background:'rgba(10,22,40,.96)',borderBottom:'1px solid rgba(37,99,235,.2)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'0.75rem'}}>
          <Link to="/dashboard" style={{color:'rgba(255,255,255,.4)',fontSize:'0.8rem',textDecoration:'none',display:'flex',alignItems:'center',gap:'0.4rem'}}>
            ← Dashboard
          </Link>
          <span style={{color:'rgba(255,255,255,.15)'}}>|</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:700,color:'#fff'}}>
            🔍 Plagiarism Check & Reduction
          </span>
          <span style={{marginLeft:'auto',background:'rgba(37,99,235,.12)',border:'1px solid rgba(37,99,235,.25)',color:'#93c5fd',fontSize:'0.62rem',fontWeight:700,letterSpacing:'0.1em',padding:'2px 8px',borderRadius:3,textTransform:'uppercase'}}>
            Groq AI
          </span>
        </header>

        <div style={{maxWidth:1200,margin:'0 auto',padding:'2rem 1.5rem',display:'grid',gridTemplateColumns:'420px 1fr',gap:'1.5rem',alignItems:'start'}}>

          {/* ── LEFT: Upload & Config ── */}
          <div style={{display:'flex',flexDirection:'column',gap:'1rem',position:'sticky',top:'80px'}}>

            {/* Input mode toggle */}
            <div style={{...card({padding:'1.25rem'})}}>
              <Label>Input Method</Label>
              <div style={{display:'flex',gap:0,background:'rgba(255,255,255,.04)',border:'1px solid rgba(37,99,235,.2)',borderRadius:8,padding:3,marginBottom:'1rem'}}>
                {['file','paste'].map(m=>(
                  <button key={m} onClick={()=>setInputMode(m)} style={{flex:1,padding:'0.5rem',background:inputMode===m?'rgba(37,99,235,.3)':'transparent',border:inputMode===m?'1px solid rgba(37,99,235,.5)':'1px solid transparent',borderRadius:6,color:inputMode===m?'#fff':'rgba(255,255,255,.4)',fontSize:'0.8rem',fontWeight:inputMode===m?600:400,cursor:'pointer',fontFamily:"'Outfit',sans-serif",textTransform:'capitalize',transition:'all .2s'}}>
                    {m==='file'?'📄 Upload File':'📋 Paste Text'}
                  </button>
                ))}
              </div>

              {inputMode === 'file' ? (
                <div
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)setFile(f)}}
                  onClick={()=>document.getElementById('pf').click()}
                  style={{border:'2px dashed rgba(37,99,235,.25)',borderRadius:10,padding:'2rem',textAlign:'center',cursor:'pointer',background:'rgba(37,99,235,.03)',transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(37,99,235,.5)';e.currentTarget.style.background='rgba(37,99,235,.07)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(37,99,235,.25)';e.currentTarget.style.background='rgba(37,99,235,.03)'}}
                >
                  <input id="pf" type="file" accept=".doc,.docx,.pdf,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f)}} />
                  {file ? (
                    <div>
                      <div style={{fontSize:'2rem',marginBottom:'0.4rem'}}>📄</div>
                      <div style={{fontSize:'0.875rem',fontWeight:600,color:'#fff',marginBottom:'0.2rem'}}>{file.name}</div>
                      <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,.3)'}}>{(file.size/1048576).toFixed(2)} MB · click to change</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{fontSize:'2.25rem',marginBottom:'0.6rem'}}>📄</div>
                      <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,.5)',marginBottom:'0.2rem'}}>Drop your manuscript or <span style={{color:'#3b82f6',fontWeight:600}}>browse</span></div>
                      <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,.25)'}}>DOC · DOCX · PDF · TXT · up to 50MB</div>
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  value={text}
                  onChange={e=>setText(e.target.value)}
                  placeholder="Paste your manuscript text here…"
                  rows={8}
                  style={{width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.25)',borderRadius:8,padding:'0.75rem',color:'#fff',fontSize:'0.82rem',lineHeight:1.7,resize:'vertical',outline:'none',fontFamily:"'Outfit',sans-serif"}}
                />
              )}
            </div>

            {/* Journal selector */}
            <div style={{...card({padding:'1.25rem'})}}>
              <Label>Target Journal</Label>
              <select
                value={journal.label}
                onChange={e=>setJournal(JOURNALS.find(j=>j.label===e.target.value))}
                style={{width:'100%',padding:'0.65rem 0.9rem',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.25)',borderRadius:7,color:'#fff',fontSize:'0.875rem',outline:'none',fontFamily:"'Outfit',sans-serif",cursor:'pointer',marginBottom:'0.75rem'}}
              >
                {JOURNALS.map(j=>(
                  <option key={j.label} value={j.label}>{j.label} ({j.threshold}% threshold)</option>
                ))}
              </select>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.6rem 0.9rem',background:'rgba(37,99,235,.08)',border:'1px solid rgba(37,99,235,.18)',borderRadius:7}}>
                <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,.4)'}}>Accepted threshold</span>
                <span style={{fontSize:'0.875rem',fontWeight:700,color:'#3b82f6'}}>{journal.threshold}%</span>
              </div>
            </div>

            {/* Run button */}
            <button onClick={handleRun} disabled={running} style={{width:'100%',padding:'1rem',background:running?'rgba(37,99,235,.4)':'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',borderRadius:10,color:'#fff',fontSize:'0.95rem',fontWeight:700,cursor:running?'not-allowed':'pointer',fontFamily:"'Outfit',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'0.65rem',boxShadow:running?'none':'0 4px 24px rgba(37,99,235,.4)',transition:'all .2s'}}>
              {running
                ? <><span style={{width:18,height:18,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block',flexShrink:0}} />{step || 'Analysing…'}</>
                : '🔍 Run Plagiarism Check — 50 credits'
              }
            </button>

            {/* Info */}
            <div style={{...card({padding:'1rem'})}}>
              <div style={{fontSize:'0.72rem',fontWeight:600,color:'rgba(255,255,255,.3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.6rem'}}>How it works</div>
              {['AI reads your manuscript sentence by sentence','Flags sentences with high similarity patterns','Rewrites flagged sentences in your original voice','Shows before/after with accept/reject per sentence'].map((t,i)=>(
                <div key={i} style={{display:'flex',gap:'0.5rem',marginBottom:'0.4rem',fontSize:'0.75rem',color:'rgba(255,255,255,.4)',lineHeight:1.5}}>
                  <span style={{color:'#3b82f6',fontWeight:700,flexShrink:0}}>{i+1}.</span>{t}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Results ── */}
          <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>

            {!results && !running && (
              <div style={{...card({padding:'4rem 2rem',textAlign:'center'})}}>
                <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🔍</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:700,color:'rgba(255,255,255,.4)',marginBottom:'0.5rem'}}>
                  Ready to scan
                </div>
                <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,.25)'}}>
                  Upload your manuscript and click Run to see results
                </div>
              </div>
            )}

            {running && (
              <div style={{...card({padding:'4rem 2rem',textAlign:'center'})}}>
                <div style={{width:48,height:48,border:'3px solid rgba(37,99,235,.2)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 1.25rem'}} />
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:700,color:'#fff',marginBottom:'0.4rem'}}>
                  {step || 'Analysing your manuscript…'}
                </div>
                <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,.35)'}}>
                  Groq AI is reading sentence by sentence
                </div>
              </div>
            )}

            {results && (
              <>
                {/* Score cards */}
                <div style={{...card({padding:'1.5rem'}),animation:'fadeUp .4s ease both'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'2rem',flexWrap:'wrap'}}>
                    <ScoreGauge score={results.overall_score} label="Before rewrite" color={scoreColor(results.overall_score)} />
                    <div style={{fontSize:'1.5rem',color:'rgba(255,255,255,.2)'}}>→</div>
                    <ScoreGauge score={results.projected_score} label="After rewrite" color={scoreColor(results.projected_score)} />
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:700,color:'#fff',marginBottom:'0.4rem'}}>
                        {results.passes_threshold
                          ? <span style={{color:'#10b981'}}>✓ Passes {journal.label}</span>
                          : <span style={{color:'#f59e0b'}}>⚠️ Needs reduction for {journal.label}</span>
                        }
                      </div>
                      <div style={{fontSize:'0.8rem',color:'rgba(255,255,255,.4)',lineHeight:1.6,marginBottom:'0.75rem'}}>
                        {results.flagged_count} of {results.total_sentences} sentences flagged.
                        Projected score after accepting all rewrites: <strong style={{color:'#10b981'}}>{results.projected_score}%</strong>
                      </div>
                      {/* Threshold bars */}
                      {[{label:'Your score', val:results.overall_score},{label:'After rewrite', val:results.projected_score},{label:`${journal.label} limit`, val:journal.threshold}].map(b=>(
                        <div key={b.label} style={{marginBottom:'0.5rem'}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem',color:'rgba(255,255,255,.3)',marginBottom:'3px'}}>
                            <span>{b.label}</span><span>{b.val}%</span>
                          </div>
                          <div style={{height:5,background:'rgba(255,255,255,.07)',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.min(b.val,100)}%`,background:scoreColor(b.val),borderRadius:3,transition:'width .8s ease'}} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Line-by-line */}
                <div style={{...card({}),animation:'fadeUp .5s .1s ease both'}}>
                  <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid rgba(37,99,235,.12)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'0.5rem'}}>
                    <span style={{fontSize:'0.9rem',fontWeight:600,color:'#fff'}}>Line-by-Line Analysis</span>
                    <div style={{display:'flex',gap:'0.4rem'}}>
                      {['all','flagged'].map(f=>(
                        <button key={f} onClick={()=>setFilter(f)} style={{padding:'0.28rem 0.75rem',borderRadius:100,border:'1px solid',fontSize:'0.72rem',fontWeight:500,cursor:'pointer',fontFamily:"'Outfit',sans-serif",transition:'all .2s',
                          background:filter===f?'#2563eb':'transparent',
                          borderColor:filter===f?'#2563eb':'rgba(37,99,235,.25)',
                          color:filter===f?'#fff':'rgba(255,255,255,.45)',
                        }}>
                          {f==='all'?`All (${results.lines?.length||0})`:`Flagged (${results.flagged_count})`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{maxHeight:400,overflowY:'auto'}}>
                    {filteredLines.length
                      ? filteredLines.map(l=><LineItem key={l.line_num} line={l} />)
                      : <div style={{padding:'2rem',textAlign:'center',fontSize:'0.82rem',color:'rgba(255,255,255,.3)'}}>No flagged sentences found ✓</div>
                    }
                  </div>
                </div>

                {/* Rewrites */}
                {results.rewrites?.length > 0 && (
                  <div style={{animation:'fadeUp .5s .2s ease both'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
                      <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:700,color:'#fff'}}>
                        AI Rewrite Suggestions
                      </h3>
                      <span style={{background:'rgba(37,99,235,.1)',border:'1px solid rgba(37,99,235,.25)',color:'#93c5fd',fontSize:'0.65rem',fontWeight:700,padding:'3px 8px',borderRadius:100,letterSpacing:'0.06em'}}>
                        ✦ Groq AI
                      </span>
                    </div>
                    {results.rewrites.map((r,i)=>(
                      <RewriteCard
                        key={i} item={r} index={i}
                        onAccept={accept} onReject={reject}
                        accepted={decisions[i]==='accepted'}
                        rejected={decisions[i]==='rejected'}
                      />
                    ))}
                    <div style={{display:'flex',gap:'0.75rem',marginTop:'0.5rem'}}>
                      <button onClick={()=>results.rewrites.forEach((_,i)=>accept(i))} style={{flex:1,padding:'0.75rem',background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.3)',borderRadius:8,color:'#34d399',fontSize:'0.82rem',fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                        ✓ Accept All Rewrites
                      </button>
                      <button style={{flex:1,padding:'0.75rem',background:'rgba(37,99,235,.1)',border:'1px solid rgba(37,99,235,.25)',borderRadius:8,color:'#93c5fd',fontSize:'0.82rem',fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                        📄 Download Processed DOCX
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
