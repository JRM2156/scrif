exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    /* Auth */
    const token = event.headers.authorization?.split('Bearer ')[1]
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY }
    })
    const authData = await authRes.json()
    if (!authData?.id) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
    const userId = authData.id

    /* Parse body */
    const { text, job_id, journal_threshold = 15 } = JSON.parse(event.body || '{}')
    if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No text provided' }) }

    /* Call Groq - detect */
    const detectRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: `You are a plagiarism detection expert. Analyze the manuscript and identify sentences that look copied from published sources. Return ONLY a valid JSON array. Each item must have: line_num (number), text (string), match_pct (number 0-100), reason (string), source_hint (string). Only include sentences with match_pct above 30. Maximum 8 items. Return ONLY the JSON array with no other text.` },
          { role: 'user', content: `Analyze this text:\n\n${text.slice(0, 6000)}` }
        ]
      })
    })
    const detectData = await detectRes.json()
    const detectContent = detectData.choices?.[0]?.message?.content || '[]'

    let flagged = []
    try { flagged = JSON.parse(detectContent.replace(/```json|```/g, '').trim()) } catch { flagged = [] }
    if (!Array.isArray(flagged)) flagged = []

    /* Call Groq - rewrite */
    let rewrites = []
    if (flagged.length > 0) {
      const flaggedText = flagged.map((f, i) => `${i + 1}. "${f.text}"`).join('\n')
      const rewriteRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.4,
          max_tokens: 3000,
          messages: [
            { role: 'system', content: `You are an academic editor. Rewrite each sentence to remove plagiarism while keeping the scientific meaning. Return ONLY a valid JSON array. Each item must have: original (string), rewritten (string), improvement (string). Return ONLY the JSON array with no other text.` },
            { role: 'user', content: `Rewrite these sentences:\n\n${flaggedText}` }
          ]
        })
      })
      const rewriteData = await rewriteRes.json()
      const rewriteContent = rewriteData.choices?.[0]?.message?.content || '[]'
      try { rewrites = JSON.parse(rewriteContent.replace(/```json|```/g, '').trim()) } catch { rewrites = [] }
      if (!Array.isArray(rewrites)) rewrites = []
    }

    /* Calculate scores */
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const totalSents = sentences.length || 1
    const avgMatch = flagged.length ? flagged.reduce((a, b) => a + (b.match_pct || 0), 0) / flagged.length : 0
    const overallScore = Math.min(Math.round((flagged.length / totalSents) * avgMatch), 95)
    const projectedScore = Math.max(2, Math.round(overallScore * 0.25))

    /* Build lines */
    const lines = sentences.slice(0, 25).map((s, i) => {
      const f = flagged.find(fl => fl.line_num === i + 1 || fl.text?.trim().slice(0,50) === s.trim().slice(0,50))
      return { line_num: i + 1, text: s.trim(), status: f ? (f.match_pct > 60 ? 'flagged' : 'warn') : 'clean', match_pct: f?.match_pct || 0, source: f?.source_hint || '', reason: f?.reason || '' }
    })

    /* Update job */
    if (job_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/service_jobs?id=eq.${job_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() })
      })
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ overall_score: overallScore, projected_score: projectedScore, passes_threshold: projectedScore <= journal_threshold, journal_threshold, total_sentences: totalSents, flagged_count: flagged.length, flagged, rewrites, lines })
    }

  } catch (err) {
    console.error('check-plagiarism error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
