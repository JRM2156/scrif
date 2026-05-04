import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'

const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:3px}
textarea::placeholder,input::placeholder{color:rgba(255,255,255,.22)}
select option{background:#0d1f3c;color:#fff}
.fl{font-size:.67rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.32);margin-bottom:.35rem;display:block}
.fi{width:100%;padding:.6rem .85rem;background:rgba(255,255,255,.05);border:1px solid rgba(37,99,235,.22);border-radius:7px;color:#fff;font-size:.82rem;outline:none;font-family:'Outfit',sans-serif;transition:border-color .2s}
.fi:focus{border-color:#3b82f6}
.fg{margin-bottom:.85rem}
/* Letter styles */
.letter-page{
  background:#fff;
  width:210mm;
  min-height:297mm;
  margin:0 auto;
  padding:25mm 22mm 20mm;
  box-shadow:0 8px 40px rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.15);
  font-family:'Garamond','Georgia','Times New Roman',serif;
  font-size:11.5pt;
  line-height:1.75;
  color:#1a1a1a;
  position:relative;
}
.letter-sender{
  text-align:right;
  margin-bottom:2.5em;
  font-size:10.5pt;
  line-height:1.7;
  color:#2a2a2a;
}
.letter-sender strong{
  font-size:12pt;
  display:block;
  margin-bottom:.2em;
  color:#111;
}
.letter-date{
  margin-bottom:2em;
  font-size:10.5pt;
  color:#333;
}
.letter-recipient{
  margin-bottom:2em;
  font-size:10.5pt;
  line-height:1.7;
}
.letter-subject{
  font-weight:bold;
  margin-bottom:1.5em;
  font-size:11pt;
  text-decoration:underline;
  text-underline-offset:3px;
}
.letter-body p{
  margin-bottom:1.4em;
  text-align:justify;
  hyphens:auto;
}
.letter-closing{
  margin-top:2em;
}
.letter-sig{
  margin-top:3em;
  font-size:11pt;
}
.letter-sig strong{
  display:block;
  font-size:11.5pt;
}
`

const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })

const INIT = {
  name:'', affiliation:'', address:'', city:'', email:'',
  date:today, editorName:'', journal:'', title:'',
  studyType:'Original Research',
  reports:'', significance:'', journalFit:'', novelty:'',
  conflicts:'no', conflictDetails:'',
}

export default function CoverLetterPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState(INIT)
  const [generating, setGenerating] = useState(false)
  const previewRef = useRef(null)

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }
  function val(k, fallback='') { return form[k] || fallback }

  async function aiGenerate() {
    if (!form.title && !form.reports) { showToast({ title:'Fill title or study summary first', type:'warning' }); return }
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/generate-cover-letter', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` },
        body:JSON.stringify({ title:form.title, reports:form.reports, journal:form.journal, studyType:form.studyType }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setForm(f => ({ ...f, significance:data.significance||f.significance, journalFit:data.journalFit||f.journalFit, novelty:data.novelty||f.novelty }))
      showToast({ title:'AI sections generated!', type:'success' })
    } catch(err) {
      showToast({ title:'Error', message:err.message, type:'error' })
    } finally { setGenerating(false) }
  }

  function downloadPDF() {
    const win = window.open('', '_blank')
    const html = previewRef.current?.innerHTML || ''
    win.document.write(`<!DOCTYPE html><html><head><title>Cover Letter - ${val('title','Manuscript')}</title>
    <style>
      @page{margin:0}
      body{margin:0;padding:0;background:#fff}
      .letter-page{width:210mm;min-height:297mm;margin:0 auto;padding:25mm 22mm 20mm;font-family:Garamond,Georgia,'Times New Roman',serif;font-size:11.5pt;line-height:1.75;color:#1a1a1a}
      .letter-sender{text-align:right;margin-bottom:2.5em;font-size:10.5pt;line-height:1.7;color:#2a2a2a}
      .letter-sender strong{font-size:12pt;display:block;margin-bottom:.2em;color:#111}
      .letter-date{margin-bottom:2em;font-size:10.5pt;color:#333}
      .letter-recipient{margin-bottom:2em;font-size:10.5pt;line-height:1.7}
      .letter-subject{font-weight:bold;margin-bottom:1.5em;font-size:11pt;text-decoration:underline;text-underline-offset:3px}
      .letter-body p{margin-bottom:1.4em;text-align:justify}
      .letter-closing{margin-top:2em}
      .letter-sig{margin-top:3em;font-size:11pt}
      .letter-sig strong{display:block;font-size:11.5pt}
    </style></head><body>${html}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>`)
    win.document.close()
  }

  const fi = { className:'fi' }
  const ta = { className:'fi', style:{ resize:'vertical', lineHeight:1.65 } }

  return (
    <>
      <style>{CSS}</style>
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#0a1628', fontFamily:"'Outfit',sans-serif" }}>

        {/* TOPBAR */}
        <header style={{ height:56, flexShrink:0, background:'rgba(10,22,40,.97)', borderBottom:'1px solid rgba(37,99,235,.2)', display:'flex', alignItems:'center', padding:'0 1.25rem', gap:'.75rem', zIndex:100 }}>
          <Link to="/dashboard" style={{ color:'rgba(255,255,255,.4)', fontSize:'.8rem', textDecoration:'none' }}>← Dashboard</Link>
          <span style={{ color:'rgba(255,255,255,.15)' }}>|</span>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.15rem', fontWeight:700, color:'#fff' }}>✉️ Cover Letter Generator</span>
          <button onClick={aiGenerate} disabled={generating} style={{ marginLeft:'auto', padding:'.45rem 1.1rem', background:'rgba(37,99,235,.18)', border:'1px solid rgba(37,99,235,.4)', borderRadius:7, color:'#93c5fd', fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', gap:'.4rem' }}>
            {generating
              ? <><span style={{ width:12,height:12,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block' }} />Generating…</>
              : '✦ AI Generate'
            }
          </button>
        </header>

        {/* LAYOUT */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'320px 1fr', overflow:'hidden' }}>

          {/* LEFT */}
          <div style={{ borderRight:'1px solid rgba(37,99,235,.15)', overflowY:'auto', padding:'1.1rem 1.1rem 2rem', background:'rgba(255,255,255,.01)' }}>

            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.22)', marginBottom:'.75rem' }}>Author Details</div>

            <div className="fg"><label className="fl">Full Name</label><input {...fi} placeholder="Dr. Jane Smith" value={form.name} onChange={set('name')} /></div>
            <div className="fg"><label className="fl">Affiliation / Institution</label><input {...fi} placeholder="Harvard Medical School" value={form.affiliation} onChange={set('affiliation')} /></div>
            <div className="fg"><label className="fl">Address</label><input {...fi} placeholder="123 Main St, Boston, MA" value={form.address} onChange={set('address')} /></div>
            <div className="fg"><label className="fl">Corresponding Email</label><input {...fi} type="email" placeholder="jane@university.edu" value={form.email} onChange={set('email')} /></div>
            <div className="fg"><label className="fl">Date</label><input {...fi} value={form.date} onChange={set('date')} /></div>

            <div style={{ height:1, background:'rgba(37,99,235,.12)', margin:'.9rem 0' }} />
            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.22)', marginBottom:'.75rem' }}>Manuscript Details</div>

            <div className="fg"><label className="fl">Editor Name (if known)</label><input {...fi} placeholder="Prof. John Editor" value={form.editorName} onChange={set('editorName')} /></div>
            <div className="fg"><label className="fl">Manuscript Title</label><input {...fi} placeholder="Full manuscript title" value={form.title} onChange={set('title')} /></div>
            <div className="fg"><label className="fl">Journal Name</label><input {...fi} placeholder="e.g. Elsevier, Nature, JAMA" value={form.journal} onChange={set('journal')} /></div>
            <div className="fg">
              <label className="fl">Study Type</label>
              <select className="fi" value={form.studyType} onChange={set('studyType')}>
                {['Original Research','Systematic Review','Case Report','Meta-Analysis','Clinical Trial','Review Article','Letter to Editor','Short Communication'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ height:1, background:'rgba(37,99,235,.12)', margin:'.9rem 0' }} />
            <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'rgba(255,255,255,.22)', marginBottom:'.4rem' }}>Letter Content</div>
            <div style={{ fontSize:'.7rem', color:'rgba(37,99,235,.7)', marginBottom:'.75rem' }}>Fill manually or click ✦ AI Generate</div>

            <div className="fg"><label className="fl">In this paper, we report / show that…</label><textarea {...ta} rows={3} placeholder="Describe your main finding or contribution" value={form.reports} onChange={set('reports')} /></div>
            <div className="fg"><label className="fl">This is significant because…</label><textarea {...ta} rows={3} placeholder="Why does this matter to the field?" value={form.significance} onChange={set('significance')} /></div>
            <div className="fg"><label className="fl">Appropriate for this journal because…</label><textarea {...ta} rows={3} placeholder="How does it fit the journal's scope?" value={form.journalFit} onChange={set('journalFit')} /></div>
            <div className="fg"><label className="fl">Novelty & significance</label><textarea {...ta} rows={4} placeholder="Explain novelty, problem addressed, and why readers would be interested" value={form.novelty} onChange={set('novelty')} /></div>

            <div style={{ height:1, background:'rgba(37,99,235,.12)', margin:'.9rem 0' }} />
            <div className="fg">
              <label className="fl">Conflicts of Interest</label>
              <div style={{ display:'flex', gap:'.5rem', marginBottom: form.conflicts==='yes' ? '.6rem' : 0 }}>
                {['no','yes'].map(v=>(
                  <button key={v} onClick={()=>setForm(f=>({...f,conflicts:v}))} style={{ flex:1, padding:'.5rem', background:form.conflicts===v?'rgba(37,99,235,.3)':'rgba(255,255,255,.04)', border:`1px solid ${form.conflicts===v?'rgba(37,99,235,.55)':'rgba(37,99,235,.18)'}`, borderRadius:7, color:form.conflicts===v?'#fff':'rgba(255,255,255,.4)', fontSize:'.8rem', fontWeight:form.conflicts===v?600:400, cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                    {v==='no'?'✓ None':'⚠ Yes, disclose'}
                  </button>
                ))}
              </div>
              {form.conflicts==='yes' && (
                <textarea {...ta} rows={2} placeholder="Briefly describe your conflict of interest…" value={form.conflictDetails} onChange={set('conflictDetails')} />
              )}
            </div>
          </div>

          {/* RIGHT - PDF VIEWER */}
          <div style={{ overflowY:'auto', background:'#6b7280', padding:'2rem 1.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'1.5rem' }}>

            {/* Toolbar */}
            <div style={{ width:'100%', maxWidth:850, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'.78rem', color:'rgba(255,255,255,.5)', fontWeight:500 }}>
                Live Preview — updates as you type
              </span>
              <button onClick={downloadPDF} style={{ padding:'.5rem 1.25rem', background:'#1d4ed8', border:'none', borderRadius:7, color:'#fff', fontSize:'.82rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', gap:'.4rem', boxShadow:'0 2px 12px rgba(37,99,235,.4)' }}>
                ⬇ Download PDF
              </button>
            </div>

            {/* Letter page */}
            <div ref={previewRef} className="letter-page" style={{ width:'210mm', minHeight:'297mm' }}>

              {/* Sender - right aligned */}
              <div className="letter-sender">
                {form.name && <strong>{form.name}</strong>}
                {form.affiliation && <span>{form.affiliation}<br/></span>}
                {form.address && <span>{form.address}<br/></span>}
                {form.email && <span>{form.email}</span>}
              </div>

              {/* Date */}
              <div className="letter-date">{form.date}</div>

              {/* Recipient */}
              <div className="letter-recipient">
                {form.editorName
                  ? <><strong>Dear {form.editorName},</strong></>
                  : <><strong>Dear Editor-in-Chief,</strong></>
                }
                {form.journal && <><br/><em>{form.journal}</em></>}
              </div>

              {/* Subject line */}
              {form.title && (
                <div className="letter-subject">
                  Re: Submission of Manuscript — "{form.title}"
                </div>
              )}

              {/* Body */}
              <div className="letter-body">
                <p>
                  I/We wish to submit {form.studyType === 'Review Article' ? 'a review article' : form.studyType === 'Case Report' ? 'a case report' : `an ${form.studyType.toLowerCase()}`} entitled <em>"{val('title','[Manuscript Title]')}"</em> for consideration by <strong>{val('journal','[Journal Name]')}</strong>.
                </p>

                <p>
                  I/We confirm that this work is original and has not been published elsewhere, nor is it currently under consideration for publication elsewhere.
                </p>

                {(form.reports || form.significance) && (
                  <p>
                    In this paper, I/we {val('reports','report on ______')}. This is significant because {val('significance','______')}.
                  </p>
                )}

                {form.journalFit && (
                  <p>
                    We believe that this manuscript is appropriate for publication by <strong>{val('journal','[Journal Name]')}</strong> because {form.journalFit}.
                  </p>
                )}

                {form.novelty && (
                  <p>{form.novelty}</p>
                )}

                <p>
                  {form.conflicts === 'yes'
                    ? form.conflictDetails
                      ? `The authors wish to disclose the following conflict of interest: ${form.conflictDetails}`
                      : 'The authors have conflicts of interest to disclose, details of which will be provided separately.'
                    : 'We have no conflicts of interest to disclose.'
                  }
                </p>

                <p>
                  Please address all correspondence concerning this manuscript to me at <strong>{val('email','[email address]')}</strong>.
                </p>

                <p>Thank you for your time and consideration of this manuscript.</p>
              </div>

              {/* Closing */}
              <div className="letter-closing">
                <p>Yours sincerely,</p>
                <div className="letter-sig">
                  <br/><br/>
                  {form.name && <strong>{form.name}</strong>}
                  {form.affiliation && <span style={{ display:'block', color:'#444', fontSize:'10.5pt' }}>{form.affiliation}</span>}
                  {form.email && <span style={{ display:'block', color:'#555', fontSize:'10pt' }}>{form.email}</span>}
                </div>
              </div>
            </div>

            {/* Bottom download */}
            <div style={{ width:'100%', maxWidth:850, display:'flex', justifyContent:'center', paddingBottom:'1rem' }}>
              <button onClick={downloadPDF} style={{ padding:'.75rem 2.5rem', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:9, color:'#fff', fontSize:'.9rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 4px 20px rgba(37,99,235,.4)' }}>
                ⬇ Download as PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
