exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Content-Type':'application/json' }
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' }

  try {
    const GROQ = process.env.GROQ_API_KEY
    const { title, reports, journal, studyType } = JSON.parse(event.body || '{}')

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization':`Bearer ${GROQ}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.5,
        max_tokens: 800,
        messages: [{
          role: 'system',
          content: 'You are an expert academic cover letter writer. Return ONLY a JSON object with keys: significance, journalFit, novelty. Each value is 1-2 sentences. No markdown, just JSON.'
        },{
          role: 'user',
          content: `Title: ${title}\nStudy type: ${studyType}\nWe report: ${reports}\nTarget journal: ${journal || 'a peer-reviewed journal'}\n\nGenerate significance, journalFit, and novelty sections.`
        }]
      })
    })

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    let result = {}
    try { result = JSON.parse(content.replace(/```json|```/g,'').trim()) } catch { result = {} }

    return { statusCode:200, headers, body: JSON.stringify(result) }
  } catch (err) {
    return { statusCode:500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
