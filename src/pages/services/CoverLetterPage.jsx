import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:2px}
textarea::placeholder,input::placeholder{color:rgba(255,255,255,.25)}
select option{background:#0d1f3c;color:#fff}
.field-label{font-size:.67rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:.35rem;display:block}
.field-input{width:100%;padding:.6rem .85rem;background:rgba(255,255,255,.05);border:1px solid rgba(37,99,235,.25);border-radius:7px;color:#fff;font-size:.82rem;outline:none;font-family:'Outfit',sans-serif;transition:border-color .2s}
.field-input:focus{border-color:#3b82f6}
.field-group{margin-bottom:.875rem}
`

const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })

const INIT = {
  name:'', affiliation:'', address:'', date:today,
  editorName:'', title:'', journal:'', studyType:'original research',
  reports:'', significance:'', journalFit:'', novelty:'',
  conflicts:'no', email:'',
}

function buildLetter(f) {
  return `${f.name || '[Your Name]'}
${f.affiliation || '[Your Affiliation]'}
${f.address || '[Your Address]'}

${f.date}

Dear ${f.editorName || '[Editor Name]'},

I/We wish to submit an original research article entitled "${f.title || '[Title of Article]'}" for consideration by ${f.journal || '[Journal Name]'}.

I/We confirm that this work is original and has not been published elsewhere, nor is it currently under consideration for publication elsewhere.

In this paper, I/we ${f.reports || 'report on ______'}. This is significant because ${f.significance || '______'}.

We believe that this manuscript is appropriate for publication by ${f.journal || '[Journal Name]'} because ${f.journalFit || '______'}.

${f.novelty || '[Please explain the significance and novelty of the work, the problem being addressed, and why the manuscript belongs in this journal.]'}

${f.conflicts === 'yes'
  ? 'Please note that the authors have conflicts of interest to disclose, details of which are provided separately.'
  : 'We have no conflicts of interest to disclose.'
}

Please address all correspondence concerning this manuscript to me at ${f.email || '[email address]'}.

Thank you for your consideration of this manuscript.

Sincerely,

${f.name || '[Your Name]'}
${f.affiliation || '[Your Affiliation]'}`
}

export default function CoverLetterPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState(INIT)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const letterRef = useRef(null)

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  const letter = buildLetter(form)

  /* AI generate significance/fit/novelty */
  async function aiGenerate() {
    if (!form.title || !form.reports) {
      showToast({ title: 'Fill title and what you report first', type: 'warning' }); return
    }
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: form.title, reports: form.reports, journal: form.journal, studyType: form.studyType }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setForm(f => ({
        ...f,
        significance: data.significance || f.significance,
        journalFit:   data.journalFit   || f.journalFit,
        novelty:      data.novelty      || f.novelty,
      }))
      showToast({ title: 'AI sections generated!', type: 'success' })
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  /* Download as PDF using print */
  function downloadPDF() {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Cover Letter</title>
      <style>
        body{font-family:Georgia,serif;font-size:12pt;line-height:1.8;color:#000;max-width:700px;margin:60px auto;padding:0 40px}
        p{margin-bottom:1em;white-space:pre-wrap}
        @media print{body{margin:0}}
      </style></head><body>
      <p>${letter.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</p>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const inputStyle = { width:'100%', padding:'.6rem .85rem', background:'rgba(255,255,255,.05)', border:'1px solid rgba(37,99,235,.25)', borderRadius:7, color:'#fff', fontSize:'.82rem', outline:'none', fontFamily:"'Outfit',sans-serif" }
  const taStyle = { ...inputStyle, resize:'vertical', lineHeight:1.65 }

  return (
    <>
      <style>{CSS}</style>
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#0a1628', fontFamily:"'Outfit',sans-serif" }}>

        {/* TOPBAR */}
        <header style={{ height:56, flexShrink:0, background:'rgba(10,22,40,.97)', borderBottom:'1px solid rgba(37,99,235,.2)', display:'flex', alignItems:'center', padding:'0 1.25rem', gap:'.75rem', zIndex:100 }}>
          <Link to="/dashboard" style={{ color:'rgba(255,255,255,.45)', fontSize:'.8rem', textDecoration:'none' }}>← Dashboard</Link>
          <span style={{ color:'rgba(255,255,255,.15)' }}>|</span>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', fontWeight:700, color:'#fff' }}>✉️ Cover Letter Generator</span>
          <div style={{ marginLeft:'auto', display:'flex', gap:'.6rem' }}>
            <button onClick={aiGenerate} disabled={generating} style={{ padding:'.45rem 1rem', background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.35)', borderRadius:7, color:'#93c5fd', fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', gap:'.4rem' }}>
              {generating ? <><span style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block' }} />Generating…</> : '✦ AI Generate'}
            </button>
            <button onClick={downloadPDF} style={{ padding:'.45rem 1rem', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:7, color:'#fff', fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
              ⬇ Download PDF
            </button>
          </div>
        </header>

        {/* MAIN */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'340px 1fr', overflow:'hidden' }}>

          {/* LEFT - FORM */}
          <div style={{ borderRight:'1px solid rgba(37,99,235,.15)', overflowY:'auto', padding:'1.25rem', background:'rgba(255,255,255,.01)' }}>

            <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.25)', marginBottom:'1rem' }}>Author Details</div>

            {[['name','Your Full Name','text'],['affiliation','Institution / University','text'],['address','Address (optional)','text'],['email','Corresponding Email','email']].map(([k,ph,type]) => (
              <div key={k} className="field-group">
                <label className="field-label">{ph}</label>
                <input type={type} placeholder={ph} value={form[k]} onChange={set(k)} style={inputStyle} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='rgba(37,99,235,.25)'} />
              </div>
            ))}

            <div className="field-group">
              <label className="field-label">Date</label>
              <input type="text" value={form.date} onChange={set('date')} style={inputStyle} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='rgba(37,99,235,.25)'} />
            </div>

            <div style={{ height:1, background:'rgba(37,99,235,.15)', margin:'1rem 0' }} />
            <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.25)', marginBottom:'1rem' }}>Manuscript Details</div>

            {[['editorName','Editor Name (if known)'],['title','Manuscript Title'],['journal','Journal Name']].map(([k,ph]) => (
              <div key={k} className="field-group">
                <label className="field-label">{ph}</label>
                <input type="text" placeholder={ph} value={form[k]} onChange={set(k)} style={inputStyle} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='rgba(37,99,235,.25)'} />
              </div>
            ))}

            <div className="field-group">
              <label className="field-label">Study Type</label>
              <select value={form.studyType} onChange={set('studyType')} style={inputStyle}>
                {['Original Research','Systematic Review','Case Report','Meta-Analysis','Clinical Trial','Review Article','Letter to Editor'].map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
              </select>
            </div>

            <div style={{ height:1, background:'rgba(37,99,235,.15)', margin:'1rem 0' }} />
            <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.25)', marginBottom:'1rem' }}>
              Letter Content
              <span style={{ marginLeft:'.5rem', color:'rgba(37,99,235,.6)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>· click ✦ AI Generate to auto-fill</span>
            </div>

            {[
              ['reports','In this paper, we report on / show that…', 3],
              ['significance','This is significant because…', 3],
              ['journalFit','Appropriate for this journal because…', 3],
              ['novelty','Significance, novelty & problem addressed…', 4],
            ].map(([k,ph,rows]) => (
              <div key={k} className="field-group">
                <label className="field-label">{ph.split('…')[0]}</label>
                <textarea placeholder={ph} value={form[k]} onChange={set(k)} rows={rows} style={taStyle} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='rgba(37,99,235,.25)'} />
              </div>
            ))}

            <div className="field-group">
              <label className="field-label">Conflicts of Interest</label>
              <div style={{ display:'flex', gap:'.5rem' }}>
                {['no','yes'].map(v => (
                  <button key={v} onClick={() => setForm(f=>({...f,conflicts:v}))} style={{ flex:1, padding:'.5rem', background:form.conflicts===v?'rgba(37,99,235,.3)':'rgba(255,255,255,.04)', border:`1px solid ${form.conflicts===v?'rgba(37,99,235,.6)':'rgba(37,99,235,.2)'}`, borderRadius:7, color:form.conflicts===v?'#fff':'rgba(255,255,255,.4)', fontSize:'.8rem', fontWeight:form.conflicts===v?600:400, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                    {v === 'no' ? '✓ None' : '⚠ Yes'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT - LIVE PREVIEW */}
          <div style={{ overflowY:'auto', padding:'2.5rem', background:'#f0f0f0', display:'flex', justifyContent:'center' }}>
            <div ref={letterRef} style={{ background:'#fff', width:'100%', maxWidth:720, minHeight:'80vh', padding:'3rem 3.5rem', boxShadow:'0 4px 32px rgba(0,0,0,.15)', borderRadius:4, fontFamily:"Georgia,'Times New Roman',serif", fontSize:'11.5pt', lineHeight:1.9, color:'#1a1a1a' }}>
              {letter.split('\n\n').map((block, i) => (
                <p key={i} style={{ marginBottom:'1.1em', whiteSpace:'pre-wrap' }}>{block}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
