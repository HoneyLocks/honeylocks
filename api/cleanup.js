module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  const { secret } = req.body || {}
  if (secret !== 'honey-cleanup-2026') return res.status(403).json({ error: 'forbidden' })

  const BASE = process.env.SUPABASE_URL + '/rest/v1/reservations'
  const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
  }

  // Supprimer les réservations dont le nom commence par "test_" ou "flow_"
  const patterns = [
    'cliente_nom=ilike.test_%',
    'cliente_nom=ilike.flow_%',
  ]

  const results = []
  for (const pattern of patterns) {
    const r = await fetch(`${BASE}?${pattern}`, { method: 'DELETE', headers: HEADERS })
    results.push({ pattern, status: r.status })
  }

  res.status(200).json({ deleted: results })
}
