module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  const { secret } = req.body || {}
  if (secret !== 'honey-cleanup-2026') return res.status(403).json({ error: 'forbidden' })

  const BASE = process.env.SUPABASE_URL + '/rest/v1/reservations'
  const H = { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }

  const ids = [73, 74, 79]
  const results = []
  for (const id of ids) {
    const r = await fetch(`${BASE}?id=eq.${id}`, { method: 'DELETE', headers: H })
    results.push({ id, status: r.status })
  }
  res.status(200).json({ deleted: results })
}
