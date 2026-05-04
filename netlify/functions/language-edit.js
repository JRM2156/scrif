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

    const { text, sourceLang } = JSON.parse(event.body || '{}')
    if (!text) return { statusCode:400, headers, body:JSON.stringify({error:'No text'}) }

    const groq = async (system, user) => {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${GROQ}`,'Content-Type':'application/json'},
        body:JSON.stringify({ model:'llama-3.3-70b-versatile', temperature:0.3, max_tokens:3000, messages:[{role:'system',content:system},{role:'user',content:user}] })
      })
      const d = await r.json()
      return d.choices?.[0]?.message?.content || '[]'
    }

    const needsTranslation = sourceLang !== 'Auto-detect' && sourceLang !== 'English'

    // Step 1: Detect language if auto-detect, then translate if non-English
    let workingText = text
    if (sourceLang === 'Auto-detect') {
      // Detect and translate in one call
      const detectResult = await groq(
        `You are a language expert. First detect the language of the text. If it is NOT English, translate it to academic English. If it IS English, return it as-is. Return ONLY the English text, nothing else.`,
        text.slice(0, 6000)
      )
      workingText = detectResult
    } else if (needsTranslation) {
      const translated = await groq(
        `You are a professional academic translator. Translate the following text from ${sourceLang} to English. Preserve all technical terms, numbers, and scientific notation. Return ONLY the translated text, nothing else.`,
        text.slice(0, 6000)
      )
      workingText = translated
    }

    // Step 2: Grammar issues
    const gramResult = await groq(
      `You are an expert academic English editor. Find grammar errors in the text. Return ONLY a JSON array. Each item: {original, suggestion, reason}. Max 8 items. original must be exact text from the document. No markdown.`,
      `Find grammar errors:\n\n${workingText.slice(0,5000)}`
    )

    // Step 3: Clarity issues
    const clarityResult = await groq(
      `You are an academic writing expert. Find sentences that are unclear, wordy, or hard to read. Suggest clearer alternatives. Return ONLY a JSON array. Each item: {original, suggestion, reason}. Max 6 items. original must be exact text. No markdown.`,
      `Find clarity issues:\n\n${workingText.slice(0,5000)}`
    )

    // Step 4: Tone issues
    const toneResult = await groq(
      `You are an academic writing expert. Find sentences that lack academic tone — too informal, casual, or unprofessional. Suggest academic alternatives. Return ONLY a JSON array. Each item: {original, suggestion, reason}. Max 5 items. original must be exact text. No markdown.`,
      `Find tone issues:\n\n${workingText.slice(0,5000)}`
    )

    let grammar=[], clarity=[], tone=[]
    try { grammar = JSON.parse(gramResult.replace(/```json|```/g,'').trim()); if(!Array.isArray(grammar))grammar=[] } catch{grammar=[]}
    try { clarity = JSON.parse(clarityResult.replace(/```json|```/g,'').trim()); if(!Array.isArray(clarity))clarity=[] } catch{clarity=[]}
    try { tone    = JSON.parse(toneResult.replace(/```json|```/g,'').trim()); if(!Array.isArray(tone))tone=[] } catch{tone=[]}

    const totalIssues = grammar.length + clarity.length + tone.length
    const score = Math.max(0, Math.min(100, 100 - (totalIssues * 4)))

    return {
      statusCode:200, headers,
      body:JSON.stringify({
        translated: needsTranslation ? workingText : null,
        grammar, clarity, tone,
        stats:{ score, totalIssues, grammarCount:grammar.length, clarityCount:clarity.length, toneCount:tone.length }
      })
    }

  } catch(err) {
    return { statusCode:500, headers, body:JSON.stringify({error:err.message}) }
  }
}
