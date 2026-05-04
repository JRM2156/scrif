exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' }

  try {
    const GROQ = process.env.GROQ_API_KEY
    const SUPA_URL = process.env.SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    const token = event.headers.authorization?.split('Bearer ')[1]
    if (!token) return { statusCode:401, headers, body:JSON.stringify({error:'Unauthorized'}) }

    const authRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { Authorization:`Bearer ${token}`, apikey:SUPA_KEY }
    })
    const authData = await authRes.json()
    if (!authData?.id) return { statusCode:401, headers, body:JSON.stringify({error:'Unauthorized'}) }

    const { text, job_id, journal_threshold=15 } = JSON.parse(event.body||'{}')
    if (!text) return { statusCode:400, headers, body:JSON.stringify({error:'No text'}) }

    const groqCall = async (system, user) => {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${GROQ}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'llama-3.3-70b-versatile',
          temperature:0.3,
          max_tokens:3000,
          messages:[{role:'system',content:system},{role:'user',content:user}]
        })
      })
      const d = await r.json()
      return d.choices?.[0]?.message?.content || '[]'
    }

    // Plagiarism detection
    const plagResult = await groqCall(
      `You are a plagiarism expert. Find sentences that match published academic sources. Return ONLY a JSON array. Each item: {text, match_pct, reason, source_hint, rewrite}. Only include sentences with match_pct above 30. Max 8 items. No markdown, just the array.`,
      `Text to analyze:\n\n${text.slice(0,5000)}`
    )

    // Grammar detection
    const gramResult = await groqCall(
      `You are an academic English editor. Find grammar, clarity and style issues. Return ONLY a JSON array. Each item: {text, reason, suggestion}. Max 6 items. No markdown, just the array.`,
      `Text to check:\n\n${text.slice(0,5000)}`
    )

    let flagged=[], grammar=[]
    try { flagged = JSON.parse(plagResult.replace(/```json|```/g,'').trim()); if(!Array.isArray(flagged))flagged=[] } catch{flagged=[]}
    try { grammar = JSON.parse(gramResult.replace(/```json|```/g,'').trim()); if(!Array.isArray(grammar))grammar=[] } catch{grammar=[]}

    const sentences = text.split(/[.!?]+/).filter(s=>s.trim().length>20)
    const totalSents = sentences.length||1
    const avgMatch = flagged.length ? flagged.reduce((a,b)=>a+(b.match_pct||0),0)/flagged.length : 0
    const overallScore = Math.min(Math.round((flagged.length/totalSents)*avgMatch),95)
    const projectedScore = Math.max(2, Math.round(overallScore*0.25))

    if(job_id) {
      await fetch(`${SUPA_URL}/rest/v1/service_jobs?id=eq.${job_id}`,{
        method:'PATCH',
        headers:{'Authorization':`Bearer ${SUPA_KEY}`,'apikey':SUPA_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({status:'completed',completed_at:new Date().toISOString()})
      })
    }

    return {
      statusCode:200, headers,
      body:JSON.stringify({
        overall_score:overallScore,
        projected_score:projectedScore,
        passes_threshold:projectedScore<=journal_threshold,
        journal_threshold,
        total_sentences:totalSents,
        flagged_count:flagged.length,
        flagged,
        grammar,
      })
    }

  } catch(err) {
    return { statusCode:500, headers, body:JSON.stringify({error:err.message}) }
  }
}
