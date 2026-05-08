exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Content-Type':'application/json' }
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' }

  try {
    const GROQ = process.env.GROQ_API_KEY
    const SUPA_URL = process.env.SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    const token = event.headers.authorization?.split('Bearer ')[1]
    if (!token) return { statusCode:401, headers, body:JSON.stringify({error:'Unauthorized'}) }
    const authRes = await fetch(`${SUPA_URL}/auth/v1/user`, { headers:{ Authorization:`Bearer ${token}`, apikey:SUPA_KEY } })
    const authData = await authRes.json()
    if (!authData?.id) return { statusCode:401, headers, body:JSON.stringify({error:'Unauthorized'}) }

    const { prompt, text } = JSON.parse(event.body || '{}')
    if (!text) return { statusCode:400, headers, body:JSON.stringify({error:'No text'}) }

    const groq = async (system, user) => {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${GROQ}`,'Content-Type':'application/json'},
        body:JSON.stringify({ model:'llama-3.3-70b-versatile', temperature:0.3, max_tokens:4000, messages:[{role:'system',content:system},{role:'user',content:user}] })
      })
      const d = await r.json()
      return d.choices?.[0]?.message?.content || ''
    }

    if (prompt === 'format_ijsr') {
      const result = await groq(
        `You are an expert academic manuscript formatter. Format the given manuscript to IJSR journal format exactly:
- Title: centered, max 120 characters
- Authors: First Last format, no salutations
- Abstract: single paragraph, max 200 words
- Keywords: exactly 5 keywords
- Sections in order: Introduction, Literature Survey, Problem Definition, Methodology/Approach, Results & Discussion, Conclusion, Future Scope, References
- References: Vancouver style [1], [2] etc
- Section headings: bold, numbered
Return the formatted manuscript as clean HTML using h1 for title, h2 for section headings, p for paragraphs. Also return a JSON issues array.
Format: {"html": "...", "issues": ["issue1", "issue2"]}
Return ONLY valid JSON, no markdown.`,
        `Format this manuscript to IJSR:\n\n${text.slice(0, 6000)}`
      )
      let data = { html:'', issues:[] }
      try { data = JSON.parse(result) } catch {
        // Try to extract HTML if JSON fails
        data.html = text.split('\n').map(l=>`<p>${l}</p>`).join('')
        data.issues = ['Could not fully parse - manual review needed']
      }
      return { statusCode:200, headers, body:JSON.stringify(data) }
    }

    if (prompt === 'plagiarism') {
      const result = await groq(
        `Find sentences that appear plagiarised or copied from published sources. Return ONLY JSON: {"flagged": [{"text": "exact sentence", "reason": "why"}]}. Max 8 items.`,
        text.slice(0, 5000)
      )
      let data = { flagged:[] }
      try { data = JSON.parse(result.replace(/```json|```/g,'').trim()) } catch { data = { flagged:[] } }
      return { statusCode:200, headers, body:JSON.stringify(data) }
    }

    if (prompt === 'suggestions') {
      const result = await groq(
        `Review this academic manuscript and identify formatting and writing issues. Return ONLY JSON: {"issues": ["issue description"]}. Max 10 items. Focus on IJSR format compliance.`,
        text.slice(0, 5000)
      )
      let data = { issues:[] }
      try { data = JSON.parse(result.replace(/```json|```/g,'').trim()) } catch { data = { issues:[] } }
      return { statusCode:200, headers, body:JSON.stringify(data) }
    }

    if (prompt === 'humanise') {
      const result = await groq(
        `Rewrite this academic text to sound naturally human-written. Preserve all scientific content and meaning. Return the rewritten text as clean HTML paragraphs only.`,
        text.slice(0, 5000)
      )
      const html = result.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('')
      return { statusCode:200, headers, body:JSON.stringify({ html }) }
    }

    return { statusCode:400, headers, body:JSON.stringify({error:'Unknown prompt'}) }

  } catch(err) {
    return { statusCode:500, headers, body:JSON.stringify({error:err.message}) }
  }
}
