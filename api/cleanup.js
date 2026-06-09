module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  const { secret } = req.body || {}
  if (secret !== 'honey-cleanup-2026') return res.status(403).json({ error: 'forbidden' })
  const BASE = process.env.SUPABASE_URL + '/rest/v1/reservations'
  const H = { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }
  const r = await fetch(`${BASE}?id=eq.70`, { method: 'DELETE', headers: H })
  res.status(200).json({ id: 70, status: r.status })
}
