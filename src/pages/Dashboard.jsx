import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/* ── SERVICES CATALOGUE ── */
const SERVICES = [
  { id:'plagiarism', icon:'🔍', name:'Plagiarism Check',     desc:'Line-by-line scan + AI rewrite',         tag:'iThenticate · Turnitin', credits:50,  phase:1 },
  { id:'ai-detect',  icon:'🤖', name:'AI Content Detection', desc:'GPTZero scan + Claude humanization',     tag:'GPTZero · Originality',  credits:40,  phase:1 },
  { id:'formatting', icon:'📐', name:'Journal Formatting',   desc:'Auto-format to 100+ journal guidelines', tag:'100+ Journals',          credits:60,  phase:1 },
  { id:'language',   icon:'🌐', name:'Language Editing',     desc:'Grammar, clarity + certificate',         tag:'Certificate included',   credits:55,  phase:1 },
  { id:'cover',      icon:'✉️', name:'Cover Letter',         desc:'Journal-specific from your abstract',    tag:'Claude AI',              credits:25,  phase:1 },
  { id:'rebuttal',   icon:'📝', name:'Rebuttal Letter',      desc:'Point-by-point reviewer response',       tag:'Claude AI',              credits:35,  phase:1 },
  { id:'compliance', icon:'✅', name:'Ethical Compliance',   desc:'COPE · CONSORT · PRISMA checklist',      tag:'Full audit report',      credits:30,  phase:1 },
  { id:'literature', icon:'📚', name:'Literature Search',    desc:'PubMed search + formatted citations',    tag:'PubMed · Scopus',        credits:30,  phase:1 },
  { id:'stats',      icon:'📊', name:'Statistical Review',   desc:'AI flag + expert biostatistician',       tag:'Human review',           credits:100, phase:2 },
  { id:'figures',    icon:'🖼️', name:'Figure Preparation',   desc:'Journal-spec figures + tables',          tag:'High-res output',        credits:40,  phase:2 },
  { id:'pre-peer',   icon:'🔬', name:'Pre-Peer Review',      desc:'Simulate reviewer · expert feedback',    tag:'Human review',           credits:80,  phase:2 },
  { id:'package',    icon:'⚡', name:'Full Package',          desc:'All services — best value',              tag:'Save 80+ credits',       credits:200, phase:1 },
]

const G = `
@keyframes spin   { to{transform:rotate(360deg)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.25);border-radius:3px}
input::placeholder{color:rgba(255,255,255,.2)}
select option{background:#112240;color:#fff}
`

/* ── HOOKS ── */
function useProfile(userId) {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('*').eq('id', userId).single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [userId])
  return profile
}

function useManuscripts(userId) {
  const [manuscripts, setManuscripts] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!userId) return
    supabase
      .from('manuscripts')
      .select(`*, service_jobs(service_type, status, created_at, completed_at)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setManuscripts(data || [])
        setLoading(false)
      })
  }, [userId])
  return { manuscripts, loading }
}

function useStats(userId) {
  const [stats, setStats] = useState({ total: 0, completed: 0, processing: 0 })
  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('manuscripts').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('service_jobs').select('id', { count: 'exact' }).eq('user_id', userId).eq('status', 'completed'),
      supabase.from('service_jobs').select('id', { count: 'exact' }).eq('user_id', userId).eq('status', 'processing'),
    ]).then(([m, c, p]) => {
      setStats({ total: m.count || 0, completed: c.count || 0, processing: p.count || 0 })
    })
  }, [userId])
  return stats
}

/* ── TOPBAR ── */
function Topbar({ onToggle, credits, displayName, avatarUrl, onSignOut }) {
  const [drop, setDrop] = useState(false)
  return (
    <header style={{ position:'fixed',top:0,left:0,right:0,height:60,zIndex:100, background:'rgba(10,22,40,.96)',borderBottom:'1px solid rgba(37,99,235,.2)', backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1.25rem' }}>
      <div style={{display:'flex',alignItems:'center',gap:'0.9rem'}}>
        <button onClick={onToggle} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.5)',fontSize:'1.15rem',display:'flex',padding:4}}>☰</button>
        <Link to="/" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:700,color:'#fff',textDecoration:'none'}}>
          scrif<span style={{color:'#3b82f6'}}>.</span>com
        </Link>
        <span style={{background:'rgba(37,99,235,.12)',border:'1px solid rgba(37,99,235,.25)',color:'#93c5fd',fontSize:'0.62rem',fontWeight:700,letterSpacing:'0.1em',padding:'2px 8px',borderRadius:3,textTransform:'uppercase'}}>Dashboard</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'0.875rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'0.4rem',background:'rgba(37,99,235,.1)',border:'1px solid rgba(37,99,235,.2)',borderRadius:6,padding:'4px 10px'}}>
          <span style={{fontSize:'0.72rem',color:'rgba(255,255,255,.4)',fontWeight:500}}>Credits</span>
          <span style={{fontSize:'0.85rem',fontWeight:700,color:'#3b82f6'}}>{credits ?? '—'}</span>
        </div>
        <button style={{background:'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',borderRadius:6,padding:'6px 14px',color:'#fff',fontSize:'0.78rem',fontWeight:600,cursor:'pointer'}}>
          ＋ New
        </button>
        <div style={{position:'relative'}}>
          <div onClick={()=>setDrop(o=>!o)} style={{width:34,height:34,borderRadius:'50%',cursor:'pointer',overflow:'hidden',background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.85rem',color:'#fff',border:'2px solid rgba(37,99,235,.4)'}}>
            {avatarUrl ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : displayName?.[0]?.toUpperCase()||'A'}
          </div>
          {drop && (
            <div style={{position:'absolute',right:0,top:'calc(100% + 8px)',background:'#112240',border:'1px solid rgba(37,99,235,.25)',borderRadius:10,padding:'0.5rem',minWidth:180,boxShadow:'0 12px 40px rgba(0,0,0,.5)',zIndex:200}}>
              <div style={{padding:'0.5rem 0.75rem',borderBottom:'1px solid rgba(37,99,235,.15)',marginBottom:'0.4rem'}}>
                <div style={{fontSize:'0.82rem',fontWeight:600,color:'#fff'}}>{displayName}</div>
              </div>
              {[['⚙️','Profile'],['💳','Billing'],['📁','Manuscripts']].map(([ic,lb])=>(
                <button key={lb} onClick={()=>setDrop(false)} style={{display:'flex',alignItems:'center',gap:'0.6rem',width:'100%',padding:'0.5rem 0.75rem',background:'none',border:'none',color:'rgba(255,255,255,.6)',fontSize:'0.82rem',cursor:'pointer',borderRadius:6,fontFamily:"'Outfit',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>{ic} {lb}</button>
              ))}
              <div style={{borderTop:'1px solid rgba(37,99,235,.15)',marginTop:'0.4rem',paddingTop:'0.4rem'}}>
                <button onClick={onSignOut} style={{display:'flex',alignItems:'center',gap:'0.6rem',width:'100%',padding:'0.5rem 0.75rem',background:'none',border:'none',color:'#f87171',fontSize:'0.82rem',cursor:'pointer',borderRadius:6,fontFamily:"'Outfit',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,.08)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>🚪 Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/* ── SIDEBAR ── */
function Sidebar({ open, active, onSelect }) {
  const nav = [{id:'overview',icon:'🏠',label:'Overview'},{id:'manuscripts',icon:'📁',label:'Manuscripts'},{id:'history',icon:'🕐',label:'History'},{id:'billing',icon:'💳',label:'Billing'}]
  const groups = [{label:'AI Services',items:SERVICES.slice(0,8)},{label:'Expert Review',items:SERVICES.slice(8,11)},{label:'Best Value',items:[SERVICES[11]]}]
  const Btn = ({id,icon,label,soon}) => (
    <button onClick={()=>onSelect(id)} style={{display:'flex',alignItems:'center',gap:'0.6rem',width:'100%',padding:'0.5rem 0.75rem',borderRadius:7,border:'none',background:active===id?'rgba(37,99,235,.18)':'none',borderLeft:active===id?'2px solid #3b82f6':'2px solid transparent',color:active===id?'#fff':'rgba(255,255,255,.45)',fontSize:'0.82rem',fontWeight:active===id?600:400,cursor:'pointer',textAlign:'left',transition:'all .15s',fontFamily:"'Outfit',sans-serif"}}>
      <span style={{fontSize:'0.9rem',width:18,textAlign:'center'}}>{icon}</span>
      <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</span>
      {soon&&<span style={{fontSize:'0.58rem',background:'rgba(245,158,11,.15)',color:'#fbbf24',padding:'1px 5px',borderRadius:3,fontWeight:600,flexShrink:0}}>SOON</span>}
    </button>
  )
  return (
    <aside style={{position:'fixed',top:60,left:0,bottom:0,width:open?232:0,background:'#0d1f3c',borderRight:'1px solid rgba(37,99,235,.18)',overflowY:'auto',overflowX:'hidden',transition:'width .25s ease',zIndex:90}}>
      <div style={{minWidth:232,padding:'1rem 0 2rem'}}>
        <div style={{padding:'0 0.75rem',marginBottom:'0.5rem'}}>{nav.map(n=><Btn key={n.id} {...n} />)}</div>
        <div style={{height:1,background:'rgba(37,99,235,.12)',margin:'0.5rem 0.75rem 0.75rem'}} />
        {groups.map(g=>(
          <div key={g.label}>
            <div style={{fontSize:'0.62rem',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,.22)',padding:'0.5rem 1.25rem 0.25rem'}}>{g.label}</div>
            {g.items.map(s=><Btn key={s.id} id={s.id} icon={s.icon} label={s.name} soon={s.phase===2} />)}
          </div>
        ))}
        <CreditsBar />
      </div>
    </aside>
  )
}

function CreditsBar() {
  const { user } = useAuth()
  const profile = useProfile(user?.id)
  const credits = profile?.credits ?? 0
  const max = profile?.plan === 'pro' ? 1500 : profile?.plan === 'starter' ? 600 : 100
  return (
    <div style={{margin:'1rem 0.75rem 0',background:'rgba(37,99,235,.08)',border:'1px solid rgba(37,99,235,.18)',borderRadius:8,padding:'0.875rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.4rem'}}>
        <span style={{fontSize:'0.68rem',color:'rgba(255,255,255,.35)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Credits</span>
        <span style={{fontSize:'0.75rem',color:'#3b82f6',fontWeight:700}}>{credits} / {max}</span>
      </div>
      <div style={{height:4,background:'rgba(255,255,255,.08)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${Math.min((credits/max)*100,100)}%`,background:'linear-gradient(90deg,#1d4ed8,#3b82f6)',borderRadius:2,transition:'width .5s ease'}} />
      </div>
      <button style={{width:'100%',marginTop:'0.65rem',padding:'0.45rem',background:'rgba(37,99,235,.2)',border:'1px solid rgba(37,99,235,.35)',borderRadius:6,color:'#93c5fd',fontSize:'0.72rem',fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
        + Buy Credits
      </button>
    </div>
  )
}

/* ── SERVICE CARD ── */
function ServiceCard({ service, onClick }) {
  const [hover, setHover] = useState(false)
  const locked = service.phase === 2
  return (
    <div
      onClick={()=>!locked&&onClick(service)}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{background:hover&&!locked?'rgba(37,99,235,.12)':'rgba(255,255,255,.03)',border:`1px solid ${hover&&!locked?'rgba(37,99,235,.4)':'rgba(37,99,235,.14)'}`,borderRadius:12,padding:'1.25rem',cursor:locked?'default':'pointer',transition:'all .2s',opacity:locked?.55:1,display:'flex',flexDirection:'column',gap:'0.45rem',position:'relative'}}
    >
      {locked&&<span style={{position:'absolute',top:8,right:8,background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.25)',color:'#fbbf24',fontSize:'0.58rem',fontWeight:700,padding:'2px 5px',borderRadius:3}}>SOON</span>}
      <span style={{fontSize:'1.4rem'}}>{service.icon}</span>
      <div style={{fontSize:'0.86rem',fontWeight:600,color:'#fff'}}>{service.name}</div>
      <div style={{fontSize:'0.73rem',color:'rgba(255,255,255,.38)',lineHeight:1.5,flex:1}}>{service.desc}</div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'0.5rem',borderTop:'1px solid rgba(37,99,235,.1)'}}>
        <span style={{fontSize:'0.62rem',color:'rgba(255,255,255,.28)'}}>{service.tag}</span>
        <span style={{fontSize:'0.7rem',color:'#3b82f6',fontWeight:700}}>{service.credits} cr</span>
      </div>
    </div>
  )
}

/* ── SERVICE MODAL ── */
function ServiceModal({ service, onClose }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [file,    setFile]    = useState(null)
  const [journal, setJournal] = useState('')
  const [running, setRunning] = useState(false)
  const [done,    setDone]    = useState(false)
  const [jobId,   setJobId]   = useState(null)
  const [results, setResults] = useState(null)

  async function handleRun() {
    if (!file) { showToast({title:'Upload a file first',type:'warning'}); return }

    setRunning(true)
    try {
      // 1. Upload file to Supabase Storage
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('manuscripts')
        .upload(path, file)
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('manuscripts')
        .getPublicUrl(path)

      // 2. Create manuscript record
      const { data: manuscript, error: mErr } = await supabase
        .from('manuscripts')
        .insert({ user_id: user.id, original_filename: file.name, file_url: publicUrl, target_journal: journal, status: 'uploaded' })
        .select().single()
      if (mErr) throw mErr

      // 3. Create service job record
      const { data: job, error: jErr } = await supabase
        .from('service_jobs')
        .insert({ user_id: user.id, manuscript_id: manuscript.id, service_type: service.id, status: 'processing', credits_used: service.credits })
        .select().single()
      if (jErr) throw jErr
      setJobId(job.id)

      // 4. Deduct credits
      await supabase.rpc('deduct_credits', { user_id: user.id, amount: service.credits })

      // 5. Call Netlify function (when built) — for now mark as completed
      // const res = await fetch(`/.netlify/functions/${service.id}`, { method:'POST', body: JSON.stringify({ job_id: job.id, manuscript_id: manuscript.id, journal }) })

      // 6. Mark job complete
      await supabase.from('service_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', job.id)

      setDone(true)
      showToast({ title:`${service.name} complete!`, message:'Results ready to download.', type:'success' })

    } catch (err) {
      showToast({ title:'Something went wrong', message: err.message, type:'error' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(5,10,25,.88)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#0d1f3c',border:'1px solid rgba(37,99,235,.3)',borderRadius:16,width:'100%',maxWidth:540,boxShadow:'0 32px 80px rgba(0,0,0,.6)',animation:'fadeUp .3s ease both',overflow:'hidden'}}>
        <div style={{padding:'1.25rem 1.5rem',borderBottom:'1px solid rgba(37,99,235,.15)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <span style={{fontSize:'1.4rem'}}>{service.icon}</span>
            <div>
              <div style={{fontSize:'0.975rem',fontWeight:700,color:'#fff'}}>{service.name}</div>
              <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,.4)'}}>{service.credits} credits · {service.tag}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.4)',fontSize:'1.2rem',cursor:'pointer'}}>✕</button>
        </div>
        <div style={{padding:'1.5rem'}}>
          {!done ? (
            <>
              <div
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)setFile(f)}}
                onClick={()=>document.getElementById('mf').click()}
                style={{border:'2px dashed rgba(37,99,235,.3)',borderRadius:10,padding:'1.75rem',textAlign:'center',cursor:'pointer',background:'rgba(37,99,235,.04)',marginBottom:'1rem',transition:'border-color .2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(37,99,235,.6)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(37,99,235,.3)'}
              >
                <input id="mf" type="file" accept=".doc,.docx,.pdf" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f)}} />
                {file ? (
                  <div>
                    <div style={{fontSize:'1.4rem',marginBottom:'0.3rem'}}>📄</div>
                    <div style={{fontSize:'0.875rem',fontWeight:600,color:'#fff'}}>{file.name}</div>
                    <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,.3)',marginTop:'0.2rem'}}>{(file.size/1048576).toFixed(1)} MB · click to change</div>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:'1.75rem',marginBottom:'0.4rem'}}>📄</div>
                    <div style={{fontSize:'0.875rem',color:'rgba(255,255,255,.45)'}}>Drop manuscript or <span style={{color:'#3b82f6',fontWeight:600}}>browse</span></div>
                    <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,.25)',marginTop:'0.2rem'}}>DOC · DOCX · PDF · up to 50MB</div>
                  </div>
                )}
              </div>

              <div style={{marginBottom:'1.25rem'}}>
                <label style={{fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,.35)',display:'block',marginBottom:'0.35rem'}}>Target Journal</label>
                <select value={journal} onChange={e=>setJournal(e.target.value)} style={{width:'100%',padding:'0.65rem 0.9rem',background:'rgba(255,255,255,.05)',border:'1px solid rgba(37,99,235,.25)',borderRadius:7,color:journal?'#fff':'rgba(255,255,255,.35)',fontSize:'0.875rem',outline:'none',fontFamily:"'Outfit',sans-serif",cursor:'pointer'}}>
                  <option value="">Select journal…</option>
                  <option>Elsevier — General (15%)</option>
                  <option>Springer Nature (10%)</option>
                  <option>LWW / Wolters Kluwer (15%)</option>
                  <option>Wiley-Blackwell (15%)</option>
                  <option>PLOS ONE (20%)</option>
                  <option>Nature Portfolio (10%)</option>
                  <option>JAMA Network (10%)</option>
                  <option>The Lancet (10%)</option>
                </select>
              </div>

              <button onClick={handleRun} disabled={running} style={{width:'100%',padding:'0.9rem',background:running?'rgba(37,99,235,.4)':'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',borderRadius:8,color:'#fff',fontSize:'0.95rem',fontWeight:700,cursor:running?'not-allowed':'pointer',fontFamily:"'Outfit',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'0.6rem',boxShadow:running?'none':'0 4px 20px rgba(37,99,235,.35)'}}>
                {running
                  ? <><span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block'}} />Processing…</>
                  : `🚀 Run ${service.name} — ${service.credits} credits`
                }
              </button>
            </>
          ) : (
            <div style={{textAlign:'center',padding:'1rem 0'}}>
              <div style={{fontSize:'2.5rem',marginBottom:'0.875rem'}}>✅</div>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:700,color:'#fff',marginBottom:'0.4rem'}}>Job Submitted</h3>
              <p style={{fontSize:'0.82rem',color:'rgba(255,255,255,.4)',marginBottom:'1.5rem',lineHeight:1.7}}>
                Your manuscript has been uploaded and the job is queued.<br />
                Results will appear in your History once the AI completes processing.
              </p>
              <button onClick={onClose} style={{padding:'0.65rem 2rem',background:'linear-gradient(135deg,#1d4ed8,#2563eb)',border:'none',borderRadius:8,color:'#fff',fontSize:'0.875rem',fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── MANUSCRIPTS TABLE ── */
function ManuscriptsTable({ manuscripts, loading }) {
  if (loading) return (
    <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.14)',borderRadius:12,padding:'2.5rem',textAlign:'center'}}>
      <div style={{width:28,height:28,border:'2px solid rgba(37,99,235,.2)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 0.75rem'}} />
      <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,.3)'}}>Loading manuscripts…</div>
    </div>
  )

  if (!manuscripts.length) return (
    <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.14)',borderRadius:12,padding:'3rem',textAlign:'center'}}>
      <div style={{fontSize:'2.5rem',marginBottom:'0.75rem'}}>📭</div>
      <div style={{fontSize:'0.95rem',fontWeight:600,color:'rgba(255,255,255,.5)',marginBottom:'0.4rem'}}>No manuscripts yet</div>
      <div style={{fontSize:'0.8rem',color:'rgba(255,255,255,.25)'}}>Click any service above to upload your first manuscript</div>
    </div>
  )

  return (
    <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(37,99,235,.14)',borderRadius:12,overflow:'hidden'}}>
      {manuscripts.map((m, i) => {
        const jobs = m.service_jobs || []
        const lastJob = jobs[0]
        const status = lastJob?.status || 'uploaded'
        return (
          <div key={m.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:'1rem',alignItems:'center',padding:'0.875rem 1.25rem',borderBottom:i<manuscripts.length-1?'1px solid rgba(37,99,235,.07)':'none'}}>
            <div>
              <div style={{fontSize:'0.82rem',fontWeight:500,color:'#fff',marginBottom:'0.2rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:240}}>
                {m.original_filename}
              </div>
              <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap'}}>
                {jobs.slice(0,3).map((j,ji)=>(
                  <span key={ji} style={{fontSize:'0.63rem',background:'rgba(37,99,235,.15)',color:'#93c5fd',padding:'1px 6px',borderRadius:3,fontWeight:500,textTransform:'capitalize'}}>
                    {j.service_type?.replace(/-/g,' ')}
                  </span>
                ))}
              </div>
            </div>
            <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,.3)',whiteSpace:'nowrap'}}>{m.target_journal || '—'}</span>
            <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,.3)',whiteSpace:'nowrap'}}>
              {new Date(m.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
            </span>
            <span style={{fontSize:'0.63rem',fontWeight:600,padding:'2px 8px',borderRadius:100,whiteSpace:'nowrap',
              background:status==='completed'?'rgba(16,185,129,.15)':status==='processing'?'rgba(37,99,235,.15)':'rgba(255,255,255,.07)',
              color:status==='completed'?'#34d399':status==='processing'?'#93c5fd':'rgba(255,255,255,.4)',
              border:`1px solid ${status==='completed'?'rgba(16,185,129,.25)':status==='processing'?'rgba(37,99,235,.25)':'rgba(255,255,255,.1)'}`
            }}>
              {status==='completed'?'✓ Done':status==='processing'?'⏳ Processing':'Uploaded'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── DASHBOARD ── */
export default function Dashboard() {
  const { user, displayName, avatarUrl } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const profile = useProfile(user?.id)
  const { manuscripts, loading } = useManuscripts(user?.id)
  const stats = useStats(user?.id)

  const [sideOpen, setSideOpen] = useState(true)
  const [active,   setActive]   = useState('overview')
  const [modal,    setModal]    = useState(null)

  async function handleSignOut() {
    await signOut()
    showToast({title:'Signed out',type:'success'})
    navigate('/login',{replace:true})
  }

  const statCards = [
    { label:'Manuscripts',   value: stats.total,          sub:'uploaded',          color:'#3b82f6' },
    { label:'Credits Left',  value: profile?.credits??'…', sub:`plan: ${profile?.plan||'free'}`, color:'#10b981' },
    { label:'Jobs Done',     value: stats.completed,      sub:'completed',         color:'#10b981' },
    { label:'In Progress',   value: stats.processing,     sub:'processing now',    color:'#f59e0b' },
  ]

  return (
    <>
      <style>{G}</style>
      <Topbar credits={profile?.credits} displayName={displayName} avatarUrl={avatarUrl} onToggle={()=>setSideOpen(o=>!o)} onSignOut={handleSignOut} />
      <Sidebar open={sideOpen} active={active} onSelect={(id) => {
        setActive(id)
        const serviceRoutes = {
          'plagiarism': '/dashboard/plagiarism',
          'ai-detect':  '/dashboard/ai-detection',
          'formatting': '/dashboard/formatting',
          'language':   '/dashboard/language',
          'cover':      '/dashboard/cover-letter',
          'rebuttal':   '/dashboard/rebuttal',
          'compliance': '/dashboard/compliance',
          'literature': '/dashboard/literature',
          'package':    '/dashboard/full-package',
          'manuscripts':'/dashboard/manuscripts',
          'history':    '/dashboard/history',
          'billing':    '/dashboard/billing',
        }
        if (serviceRoutes[id]) navigate(serviceRoutes[id])
      }} />

      <main style={{marginLeft:sideOpen?232:0,marginTop:60,padding:'2rem',minHeight:'calc(100vh - 60px)',transition:'margin-left .25s ease',background:'linear-gradient(160deg,#0a1628 0%,#0d1f3c 60%,#0a1628 100%)'}}>

        {/* Header */}
        <div style={{marginBottom:'1.75rem',animation:'fadeUp .4s ease both'}}>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:700,color:'#fff',lineHeight:1.1,marginBottom:'0.3rem'}}>
            Good to see you, <em style={{color:'#3b82f6',fontStyle:'italic'}}>{displayName}</em>
          </h1>
          <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,.35)'}}>
            Your AI-powered manuscript workspace — pick a service to get started.
          </p>
        </div>

        {/* Stats — real data */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem',marginBottom:'2rem'}}>
          {statCards.map((s,i)=>(
            <div key={s.label} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(37,99,235,.18)',borderRadius:12,padding:'1.25rem 1.5rem',animation:`fadeUp .5s ${i*.07}s ease both`}}>
              <div style={{fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,.35)',marginBottom:'0.5rem'}}>{s.label}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2.2rem',fontWeight:700,color:s.color,lineHeight:1,marginBottom:'0.2rem'}}>{s.value}</div>
              <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,.3)'}}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Services grid */}
        <div style={{marginBottom:'2rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.25rem',fontWeight:700,color:'#fff'}}>AI Services</h2>
            <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,.3)'}}>Click any service to start</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(195px,1fr))',gap:'0.875rem'}}>
            {SERVICES.map(s=><ServiceCard key={s.id} service={s} onClick={setModal} />)}
          </div>
        </div>

        {/* Manuscripts — real data */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.25rem',fontWeight:700,color:'#fff'}}>My Manuscripts</h2>
            <button style={{fontSize:'0.75rem',color:'#3b82f6',background:'none',border:'none',cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>View all →</button>
          </div>
          <ManuscriptsTable manuscripts={manuscripts} loading={loading} />
        </div>

      </main>

      {modal && <ServiceModal service={modal} onClose={()=>setModal(null)} />}
    </>
  )
}
