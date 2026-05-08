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
        `You are an expert academic manuscript formatter for IJSR journal. 

IJSR FORMAT RULES:
- Title: centered, bold, max 120 chars, Title Case
- Authors: "FirstName LastName" only (no Mr/Mrs/Dr), centered below title
- Affiliation: Institution, Department, Country — centered, italic
- Abstract: bold heading "Abstract", single paragraph MAX 200 words
- Keywords: bold "Keywords:" followed by exactly 5 comma-separated keywords
- Section headings: NUMBERED, BOLD, UPPERCASE — exactly in this order:
  1. INTRODUCTION
  2. LITERATURE SURVEY  
  3. PROBLEM DEFINITION
  4. METHODOLOGY / APPROACH
  5. RESULTS AND DISCUSSION
  6. CONCLUSION
  7. FUTURE SCOPE
  8. REFERENCES
- References: Vancouver style — [1] Author AA, Author BB. Title. Journal. Year;Vol(Issue):Pages.
- Font: Times New Roman (note in output)
- Page: A4, double column if feasible

TASK: Analyze the input manuscript. Identify and extract:
1. The title (usually first prominent line)
2. Authors (names after title)
3. Abstract section
4. Keywords
5. Each body section — map to closest IJSR section name
6. References

Then output a properly formatted HTML version with:
- <h1> for title (text-align:center)
- <p><em> for authors and affiliation (text-align:center)  
- <h2> for "Abstract"
- <p> for abstract text
- <p><strong> for "Keywords: ..."
- <h2> for each numbered section heading
- <p> for body paragraphs
- <h2> for "References"
- <p> for each reference

Also return issues array listing what was missing or changed.

Return ONLY valid JSON: {"html": "...", "issues": ["..."]}`,
        `Format this manuscript to IJSR:\n\n${text.slice(0, 7000)}`
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
