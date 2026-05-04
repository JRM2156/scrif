import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:3px}
textarea::placeholder,input::placeholder{color:rgba(255,255,255,.22)}
select option{background:#0d1f3c;color:#fff}
.fl{font-size:.67rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.32);margin-bottom:.35rem;display:block}
.fi{width:100%;padding:.6rem .85rem;background:rgba(255,255,255,.05);border:1px solid rgba(37,99,235,.22);border-radius:7px;color:#fff;font-size:.82rem;outline:none;font-family:'Outfit',sans-serif;transition:border-color .2s}
.fi:focus{border-color:#3b82f6}
.fg{margin-bottom:.85rem}
`

const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })

const INIT = {
  name:'', affiliation:'', address:'', email:'', date:today,
  editorName:'', journal:'', title:'', studyType:'Original Research',
  reports:'', significance:'', journalFit:'', novelty:'',
  conflicts:'no', conflictDetails:'',
}

/* Always show placeholder text in grey if field is empty */
function v(val, placeholder) {
  return val
    ? <span>{val}</span>
    : <span style={{color:'#bbb',fontStyle:'italic'}}>{placeholder}</span>
}

export default function CoverLetterPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState(INIT)
  const [generating, setGenerating] = useState(false)
  const letterRef = useRef(null)

  function set(k) { return e => setForm(f => ({...f, [k]: e.target.value})) }

  async function aiGenerate() {
    if (!form.title && !form.reports) { showToast({title:'Fill title or study summary first', type:'warning'}); return }
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/generate-cover-letter', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({title:form.title, reports:form.reports, journal:form.journal, studyType:form.studyType}),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setForm(f => ({...f,
        significance: data.significance || f.significance,
        journalFit:   data.journalFit   || f.journalFit,
        novelty:      data.novelty      || f.novelty,
      }))
      showToast({title:'AI sections generated!', type:'success'})
    } catch(err) {
      showToast({title:'Error', message:err.message, type:'error'})
    } finally { setGenerating(false) }
  }

  function downloadPDF() {
    const content = letterRef.current?.innerHTML || ''
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Cover Letter</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      @page{size:A4;margin:18mm 20mm}
      body{font-family:'Garamond','Georgia','Times New Roman',serif;font-size:11pt;line-height:1.65;color:#1a1a1a;background:#fff}
      .sender{text-align:right;margin-bottom:18pt;padding-bottom:10pt;border-bottom:1px solid #ccc}
      .sender-name{font-size:13pt;font-weight:700;color:#111;margin-bottom:3pt}
      .sender-sub{font-size:10pt;color:#444;line-height:1.5}
      .date{margin-bottom:14pt;font-size:10.5pt;color:#333}
      .recipient{margin-bottom:14pt;font-size:10.5pt;line-height:1.6}
      .subject{font-weight:700;font-size:11pt;margin-bottom:14pt;text-decoration:underline;text-underline-offset:3px}
      .body p{margin-bottom:11pt;text-align:justify}
      .closing{margin-top:14pt}
      .sig{margin-top:22pt}
      .sig-name{font-size:11.5pt;font-weight:700;color:#111}
      .sig-sub{font-size:10pt;color:#444;margin-top:2pt}
      span.ph{color:#aaa;font-style:italic}
    </style></head><body>${content}
    <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const fi = { className:'fi' }
  const ta = (rows) => ({ className:'fi', as:'textarea', style:{resize:'vertical',lineHeight:1.65}, rows })

  /* Letter styles for preview */
  const L = {
    page:{ background:'#fff', width:'100%', maxWidth:680, margin:'0 auto', padding:'28px 36px', boxShadow:'0 4px 32px rgba(0,0,0,.22)', fontFamily:"Garamond,Georgia,'Times New Roman',serif", fontSize:'11pt', lineHeight:1.65, color:'#1a1a1a', minHeight:900 },
    senderBox:{ textAlign:'right', marginBottom:20, paddingBottom:12, borderBottom:'1px solid #ccc' },
    senderName:{ fontSize:'13pt', fontWeight:700, color:'#111', marginBottom:3, display:'block' },
    senderSub:{ fontSize:'10pt', color:'#444', lineHeight:1.5, display:'block' },
    date:{ marginBottom:14, fontSize:'10.5pt', color:'#333' },
    recipient:{ marginBottom:14, fontSize:'10.5pt', lineHeight:1.6 },
    subject:{ fontWeight:700, fontSize:'11pt', marginBottom:14, textDecoration:'underline', textUnderlineOffset:3, display:'block' },
    p:{ marginBottom:11, textAlign:'justify' },
    closing:{ marginTop:14 },
    sig:{ marginTop:18 },
    sigName:{ fontSize:'11.5pt', fontWeight:700, color:'#111', display:'block' },
    sigSub:{ fontSize:'10pt', color:'#444', marginTop:2, display:'block' },
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{height:'100vh', display:'flex', flexDirection:'column', background:'#0a1628', fontFamily:"'Outfit',sans-serif"}}>

        {/* TOPBAR */}
        <header style={{height:56, flexShrink:0, background:'rgba(10,22,40,.97)', borderBottom:'1px solid rgba(37,99,235,.2)', display:'flex', alignItems:'center', padding:'0 1.25rem', gap:'.75rem', zIndex:100}}>
          <Link to="/dashboard" style={{color:'rgba(255,255,255,.4)', fontSize:'.8rem', textDecoration:'none'}}>← Dashboard</Link>
          <span style={{color:'rgba(255,255,255,.15)'}}>|</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif", fontSize:'1.15rem', fontWeight:700, color:'#fff'}}>✉️ Cover Letter Generator</span>
          <button onClick={aiGenerate} disabled={generating} style={{marginLeft:'auto', padding:'.45rem 1.1rem', background:'rgba(37,99,235,.18)', border:'1px solid rgba(37,99,235,.4)', borderRadius:7, color:'#93c5fd', fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', gap:'.4rem'}}>
            {generating ? <><span style={{width:12,height:12,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block'}}/> Generating…</> : '✦ AI Generate'}
          </button>
        </header>

        {/* MAIN */}
        <div style={{flex:1, display:'grid', gridTemplateColumns:'310px 1fr', overflow:'hidden'}}>

          {/* LEFT FORM */}
          <div style={{borderRight:'1px solid rgba(37,99,235,.15)', overflowY:'auto', padding:'1.1rem 1rem 2rem', background:'rgba(255,255,255,.01)'}}>

            <div style={{fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.22)', marginBottom:'.75rem'}}>Author Details</div>
            <div className="fg"><label className="fl">Full Name</label><input {...fi} placeholder="Dr. Jane Smith" value={form.name} onChange={set('name')}/></div>
            <div className="fg"><label className="fl">Affiliation</label><input {...fi} placeholder="Harvard Medical School" value={form.affiliation} onChange={set('affiliation')}/></div>
            <div className="fg"><label className="fl">Address</label><input {...fi} placeholder="Boston, MA, USA" value={form.address} onChange={set('address')}/></div>
            <div className="fg"><label className="fl">Email</label><input {...fi} type="email" placeholder="jane@university.edu" value={form.email} onChange={set('email')}/></div>
            <div className="fg"><label className="fl">Date</label><input {...fi} value={form.date} onChange={set('date')}/></div>

            <div style={{height:1, background:'rgba(37,99,235,.12)', margin:'.9rem 0'}}/>
            <div style={{fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.22)', marginBottom:'.75rem'}}>Manuscript Details</div>
            <div className="fg"><label className="fl">Editor Name (if known)</label><input {...fi} placeholder="Prof. John Editor" value={form.editorName} onChange={set('editorName')}/></div>
            <div className="fg"><label className="fl">Journal Name</label><input {...fi} placeholder="e.g. Elsevier, Nature" value={form.journal} onChange={set('journal')}/></div>
            <div className="fg"><label className="fl">Manuscript Title</label><input {...fi} placeholder="Full title of your paper" value={form.title} onChange={set('title')}/></div>
            <div className="fg">
              <label className="fl">Study Type</label>
              <select className="fi" value={form.studyType} onChange={set('studyType')}>
                {['Original Research','Systematic Review','Case Report','Meta-Analysis','Clinical Trial','Review Article','Letter to Editor','Short Communication'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{height:1, background:'rgba(37,99,235,.12)', margin:'.9rem 0'}}/>
            <div style={{fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.22)', marginBottom:'.3rem'}}>Letter Content</div>
            <div style={{fontSize:'.7rem', color:'rgba(37,99,235,.7)', marginBottom:'.75rem'}}>Fill manually or click ✦ AI Generate</div>

            <div className="fg"><label className="fl">In this paper, we report / show that…</label><textarea className="fi" rows={3} style={{resize:'vertical',lineHeight:1.65}} placeholder="Your main finding or contribution" value={form.reports} onChange={set('reports')}/></div>
            <div className="fg"><label className="fl">This is significant because…</label><textarea className="fi" rows={3} style={{resize:'vertical',lineHeight:1.65}} placeholder="Why does this matter?" value={form.significance} onChange={set('significance')}/></div>
            <div className="fg"><label className="fl">Appropriate for this journal because…</label><textarea className="fi" rows={3} style={{resize:'vertical',lineHeight:1.65}} placeholder="How it fits the journal scope" value={form.journalFit} onChange={set('journalFit')}/></div>
            <div className="fg"><label className="fl">Novelty & significance</label><textarea className="fi" rows={4} style={{resize:'vertical',lineHeight:1.65}} placeholder="Explain novelty, problem addressed, why readers would be interested" value={form.novelty} onChange={set('novelty')}/></div>

            <div style={{height:1, background:'rgba(37,99,235,.12)', margin:'.9rem 0'}}/>
            <div className="fg">
              <label className="fl">Conflicts of Interest</label>
              <div style={{display:'flex', gap:'.5rem', marginBottom: form.conflicts==='yes'?'.6rem':0}}>
                {['no','yes'].map(v2=>(
                  <button key={v2} onClick={()=>setForm(f=>({...f,conflicts:v2}))} style={{flex:1, padding:'.5rem', background:form.conflicts===v2?'rgba(37,99,235,.3)':'rgba(255,255,255,.04)', border:`1px solid ${form.conflicts===v2?'rgba(37,99,235,.55)':'rgba(37,99,235,.18)'}`, borderRadius:7, color:form.conflicts===v2?'#fff':'rgba(255,255,255,.4)', fontSize:'.8rem', fontWeight:form.conflicts===v2?600:400, cursor:'pointer', fontFamily:"'Outfit',sans-serif"}}>
                    {v2==='no'?'✓ None':'⚠ Yes, disclose'}
                  </button>
                ))}
              </div>
              {form.conflicts==='yes' && <textarea className="fi" rows={2} style={{resize:'vertical',lineHeight:1.65}} placeholder="Briefly describe your conflict of interest…" value={form.conflictDetails} onChange={set('conflictDetails')}/>}
            </div>
          </div>

          {/* RIGHT - PREVIEW */}
          <div style={{overflowY:'auto', background:'#525659', padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:16}}>

            {/* Toolbar */}
            <div style={{width:'100%', maxWidth:680, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'.75rem', color:'rgba(255,255,255,.45)'}}>Live preview — updates as you type</span>
              <button onClick={downloadPDF} style={{padding:'.45rem 1.1rem', background:'#1d4ed8', border:'none', borderRadius:7, color:'#fff', fontSize:'.78rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif"}}>
                ⬇ Download PDF
              </button>
            </div>

            {/* A4 Letter */}
            <div ref={letterRef} style={L.page}>

              {/* Sender - right aligned */}
              <div style={L.senderBox}>
                <span style={L.senderName}>{v(form.name, 'Your Name')}</span>
                <span style={L.senderSub}>{v(form.affiliation, 'Your Institution')}</span>
                {form.address && <span style={L.senderSub}>{form.address}</span>}
                <span style={L.senderSub}>{v(form.email, 'your@email.com')}</span>
              </div>

              {/* Date */}
              <div style={L.date}>{form.date}</div>

              {/* Recipient */}
              <div style={L.recipient}>
                <strong>Dear {form.editorName ? form.editorName : 'Editor-in-Chief'},</strong><br/>
                {v(form.journal, 'Journal Name')}
              </div>

              {/* Subject */}
              <span style={L.subject}>
                Re: Submission — {v(form.title, '"Your Manuscript Title"')}
              </span>

              {/* Body */}
              <div>
                <p style={L.p}>
                  I/We wish to submit {form.studyType === 'Review Article' ? 'a review article' : form.studyType === 'Case Report' ? 'a case report' : `an ${form.studyType.toLowerCase()}`} entitled <em>"{v(form.title, 'Manuscript Title')}"</em> for consideration by <strong>{v(form.journal, 'Journal Name')}</strong>.
                </p>

                <p style={L.p}>
                  I/We confirm that this work is original and has not been published elsewhere, nor is it currently under consideration for publication elsewhere.
                </p>

                <p style={L.p}>
                  In this paper, I/we {v(form.reports, 'report on [your main finding]')}. This is significant because {v(form.significance, '[explain significance]')}.
                </p>

                <p style={L.p}>
                  We believe that this manuscript is appropriate for publication by <strong>{v(form.journal, 'this journal')}</strong> because {v(form.journalFit, '[explain journal fit]')}.
                </p>

                {(form.novelty) && <p style={L.p}>{form.novelty}</p>}

                <p style={L.p}>
                  {form.conflicts === 'yes'
                    ? form.conflictDetails
                      ? `The authors wish to disclose the following conflict of interest: ${form.conflictDetails}`
                      : 'The authors have conflicts of interest to disclose, details of which will be provided separately.'
                    : 'We have no conflicts of interest to disclose.'
                  }
                </p>

                <p style={L.p}>
                  Please address all correspondence to me at <strong>{v(form.email, 'your@email.com')}</strong>.
                </p>

                <p style={L.p}>Thank you for your time and consideration of this manuscript.</p>
              </div>

              {/* Closing */}
              <div style={L.closing}>
                <p style={{...L.p, marginBottom:0}}>Yours sincerely,</p>
                <div style={L.sig}>
                  <span style={L.sigName}>{v(form.name, 'Your Name')}</span>
                  {form.affiliation && <span style={L.sigSub}>{form.affiliation}</span>}
                  {form.email && <span style={L.sigSub}>{form.email}</span>}
                </div>
              </div>
            </div>

            {/* Bottom download */}
            <button onClick={downloadPDF} style={{padding:'.75rem 2.5rem', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:9, color:'#fff', fontSize:'.9rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 4px 20px rgba(37,99,235,.4)', marginBottom:8}}>
              ⬇ Download as PDF
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
