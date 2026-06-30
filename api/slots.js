module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const headers = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  }

  if (req.method === 'GET') {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/slots_config?select=date,slots`,
      { headers }
    )
    const data = await r.json()
    return res.status(200).json(Array.isArray(data) ? data : [])
  }

  if (req.method === 'POST') {
    const { date, slots } = req.body
    if (!date) return res.status(400).json({ error: 'date requis' })
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/slots_config`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ date, slots: Array.isArray(slots) ? slots : [] })
      }
    )
    if (!r.ok) {
      const err = await r.text()
      console.error('[slots] upsert error:', r.status, err)
    }
    return res.status(r.ok ? 200 : 500).json({ success: r.ok })
  }

  return res.status(405).end()
}
