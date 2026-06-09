module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const HEADERS = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
  }
  const BASE = `${process.env.SUPABASE_URL}/rest/v1/reservations`

  if (req.method === 'DELETE') {
    // Supprimer tous les devis sauf padouclemence@gmail.com
    const r = await fetch(
      `${BASE}?statut=eq.devis&cliente_email=neq.padouclemence%40gmail.com`,
      { method: 'DELETE', headers: HEADERS }
    )
    return res.status(200).json({ status: r.status })
  }

  if (req.method !== 'GET') return res.status(405).end()

  const sbRes = await fetch(
    `${BASE}?statut=eq.devis&select=*&order=created_at.desc`,
    { headers: HEADERS }
  )
  const data = await sbRes.json()
  res.status(200).json(Array.isArray(data) ? data : [])
}
