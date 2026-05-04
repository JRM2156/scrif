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

// Show value or grey placeholder
function ph(val, placeholder) {
  if (val) return val
  return `<span style="color:#bbb;font-style:italic">${placeholder}</span>`
}

export default function CoverLetterPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState(INIT)
  const [generating, setGenerating] = useState(false)

  function set(k) { return e => setForm(f => ({...f, [k]: e.target.value})) }

  // Build letter HTML string
  function buildLetterHTML(forPrint = false) {
    const grey = forPrint ? 'color:#999;font-style:italic' : 'color:#bbb;font-style:italic'
    const p = (val, fallback) => val || `<span style="${grey}">${fallback}</span>`

    const conflictText = form.conflicts === 'yes'
      ? (form.conflictDetails
          ? `The authors wish to disclose the following conflict of interest: ${form.conflictDetails}`
          : 'The authors have conflicts of interest to disclose, details of which will be provided separately.')
      : 'We have no conflicts of interest to disclose.'

    const studyLabel = form.studyType === 'Review Article' ? 'a review article'
      : form.studyType === 'Case Report' ? 'a case report'
      : `an ${(form.studyType || 'original research').toLowerCase()}`

    return `
      <div style="text-align:right;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #ccc">
        <div style="font-size:13pt;font-weight:700;color:#111;margin-bottom:3px">${p(form.name,'[Your Name]')}</div>
        <div style="font-size:10pt;color:#444;line-height:1.5">${p(form.affiliation,'[Your Affiliation]')}</div>
        ${form.address ? `<div style="font-size:10pt;color:#444">${form.address}</div>` : `<div style="font-size:10pt;${grey}">[Your Address]</div>`}
        <div style="font-size:10pt;color:#444">${p(form.email,'[Your Email]')}</div>
      </div>

      <div style="margin-bottom:16px;font-size:10.5pt;color:#333">${form.date}</div>

      <div style="margin-bottom:16px;font-size:10.5pt;line-height:1.7">
        <strong>Dear ${form.editorName || `<span style="${grey}">[Editor Name]</span>`},</strong><br/>
        <em>${p(form.journal,'[Journal Name]')}</em>
      </div>

      <div style="font-weight:700;font-size:11pt;margin-bottom:16px;text-decoration:underline;text-underline-offset:3px">
        Re: Submission of Manuscript — "${p(form.title,'[Manuscript Title]')}"
      </div>

      <p style="margin-bottom:12px;text-align:justify">
        I/We wish to submit ${studyLabel} entitled <em>"${p(form.title,'[Manuscript Title]')}"</em> for consideration by <strong>${p(form.journal,'[Journal Name]')}</strong>.
      </p>

      <p style="margin-bottom:12px;text-align:justify">
        I/We confirm that this work is original and has not been published elsewhere, nor is it currently under consideration for publication elsewhere.
      </p>

      <p style="margin-bottom:12px;text-align:justify">
        In this paper, I/we ${p(form.reports,'[report on / show that ______]')}. This is significant because ${p(form.significance,'[______]')}.
      </p>

      <p style="margin-bottom:12px;text-align:justify">
        We believe that this manuscript is appropriate for publication by <strong>${p(form.journal,'[Journal Name]')}</strong> because ${p(form.journalFit,'[specific reference to the journal\'s Aims & Scope ______]')}.
      </p>

      ${form.novelty
        ? `<p style="margin-bottom:12px;text-align:justify">${form.novelty}</p>`
        : `<p style="margin-bottom:12px;text-align:justify;${grey}">[Please explain in your own words the significance and novelty of the work, the problem that is being addressed, and why the manuscript belongs in this journal.]</p>`
      }

      <p style="margin-bottom:12px;text-align:justify">${conflictText}</p>

      <p style="margin-bottom:12px;text-align:justify">
        Please address all correspondence concerning this manuscript to me at <strong>${p(form.email,'[email address]')}</strong>.
      </p>

      <p style="margin-bottom:20px;text-align:justify">Thank you for your consideration of this manuscript.</p>

      <div>
        <p>Yours sincerely,</p>
        <div style="margin-top:16px">
          <div style="font-size:11.5pt;font-weight:700;color:#111">${p(form.name,'[Your Name]')}</div>
          ${form.affiliation ? `<div style="font-size:10pt;color:#444;margin-top:2px">${form.affiliation}</div>` : ''}
          ${form.email ? `<div style="font-size:10pt;color:#555;margin-top:1px">${form.email}</div>` : ''}
        </div>
      </div>
    `
  }

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
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Cover Letter</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      @page{size:A4 portrait;margin:20mm 22mm}
      html,body{width:100%;margin:0;padding:0;background:#fff}
      body{font-family:Garamond,Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.65;color:#1a1a1a}
      p{margin-bottom:11pt;text-align:justify}
    </style></head><body>
    ${buildLetterHTML(true)}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const fi = { className:'fi' }

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
              <div style={{display:'flex', gap:'.5rem', marginBottom:form.conflicts==='yes'?'.6rem':0}}>
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
          <div style={{overflowY:'auto', background:'#525659', padding:'20px', display:'flex', flexDirection:'column', alignItems:'center', gap:16}}>
            <div style={{width:'100%', maxWidth:640, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'.75rem', color:'rgba(255,255,255,.45)'}}>Live preview · updates as you type</span>
              <button onClick={downloadPDF} style={{padding:'.42rem 1rem', background:'#1d4ed8', border:'none', borderRadius:7, color:'#fff', fontSize:'.78rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif"}}>⬇ Download PDF</button>
            </div>

            {/* Letter page */}
            <div style={{width:'100%', maxWidth:640, background:'#fff', padding:'40px 48px', boxShadow:'0 4px 32px rgba(0,0,0,.3)', fontFamily:"Garamond,Georgia,'Times New Roman',serif", fontSize:'11pt', lineHeight:1.65, color:'#1a1a1a', minHeight:800}}
              dangerouslySetInnerHTML={{__html: buildLetterHTML(false)}}
            />

            <button onClick={downloadPDF} style={{padding:'.7rem 2.5rem', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', borderRadius:9, color:'#fff', fontSize:'.88rem', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 4px 20px rgba(37,99,235,.4)', marginBottom:8}}>
              ⬇ Download as PDF
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
