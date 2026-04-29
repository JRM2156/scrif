const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions'

/* ── Call Groq ── */
async function callGroq(systemPrompt, userPrompt) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens:  4000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error: ${err}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

/* ── Main handler ── */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    /* 1. Auth — verify JWT */
    const token = event.headers.authorization?.split('Bearer ')[1]
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }

    /* 2. Parse body */
    const { text, job_id, journal_threshold = 15 } = JSON.parse(event.body || '{}')
    if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No text provided' }) }

    /* 3. Step 1 — Detect flagged sentences */
    const detectPrompt = `You are an academic plagiarism detection expert. Analyze the following manuscript text and identify sentences that:
- Are overly generic academic phrases likely copied from published sources
- Match common textbook or journal language patterns
- Could trigger similarity flags in iThenticate or Turnitin

Return ONLY a JSON array. Each item must have:
- "line_num": sentence number (1-indexed)
- "text": the exact sentence
- "match_pct": estimated similarity percentage (0-100)
- "reason": why it looks copied (1 sentence)
- "source_hint": likely source type (e.g. "Medical textbook", "Review article", "WHO guideline")

Only flag sentences with estimated match_pct above 30. Return maximum 10 flagged sentences.
Return ONLY the JSON array, no other text.`

    const detectResult = await callGroq(detectPrompt, `MANUSCRIPT TEXT:\n\n${text.slice(0, 8000)}`)

    let flagged = []
    try {
      const cleaned = detectResult.replace(/```json|```/g, '').trim()
      flagged = JSON.parse(cleaned)
    } catch {
      flagged = []
    }

    /* 4. Step 2 — Rewrite each flagged sentence */
    const rewritePrompt = `You are an expert academic editor. Rewrite each flagged sentence to:
- Eliminate textual similarity with published sources
- Preserve the exact scientific meaning and all technical terms
- Maintain the author's academic voice and register
- Sound naturally written by the original author

Return ONLY a JSON array where each item has:
- "original": the original sentence (copy exactly)
- "rewritten": your rewritten version
- "improvement": one sentence explaining what you changed

Return ONLY the JSON array, no other text.`

    let rewrites = []
    if (flagged.length > 0) {
      const flaggedText = flagged.map((f, i) => `${i + 1}. "${f.text}"`).join('\n')
      const rewriteResult = await callGroq(rewritePrompt, `FLAGGED SENTENCES TO REWRITE:\n\n${flaggedText}`)
      try {
        const cleaned = rewriteResult.replace(/```json|```/g, '').trim()
        rewrites = JSON.parse(cleaned)
      } catch {
        rewrites = []
      }
    }

    /* 5. Calculate overall score */
    const sentences    = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const totalSents   = sentences.length || 1
    const flaggedCount = flagged.length
    const avgMatch     = flagged.length
      ? flagged.reduce((a, b) => a + (b.match_pct || 0), 0) / flagged.length
      : 0
    const overallScore   = Math.round((flaggedCount / totalSents) * avgMatch)
    const projectedScore = Math.max(2, Math.round(overallScore * 0.25))
    const passesThreshold = projectedScore <= journal_threshold

    /* 6. Build line-by-line breakdown */
    const allLines = sentences.slice(0, 30).map((s, i) => {
      const f = flagged.find(fl => fl.line_num === i + 1 || fl.text?.trim() === s.trim())
      return {
        line_num:   i + 1,
        text:       s.trim(),
        status:     f ? (f.match_pct > 60 ? 'flagged' : 'warn') : 'clean',
        match_pct:  f?.match_pct || 0,
        source:     f?.source_hint || '',
        reason:     f?.reason || '',
      }
    })

    /* 7. Update job record in Supabase */
    if (job_id) {
      await supabase.from('service_jobs').update({
        status:       'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', job_id)
    }

    /* 8. Return results */
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        overall_score:    overallScore,
        projected_score:  projectedScore,
        passes_threshold: passesThreshold,
        journal_threshold,
        total_sentences:  totalSents,
        flagged_count:    flaggedCount,
        flagged,
        rewrites,
        lines:            allLines,
      }),
    }

  } catch (err) {
    console.error('check-plagiarism error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
