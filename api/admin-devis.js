module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'DELETE') {
    const id = req.query && req.query.id
    if (!id) return res.status(400).json({ error: 'id requis' })
    try {
      await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/reservations?id=eq.${id}&statut=eq.devis`,
        {
          method: 'DELETE',
          headers: {
            'apikey': process.env.SUPABASE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
          }
        }
      )
      return res.status(200).json({ success: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method !== 'GET') return res.status(405).end()

  const sbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.devis&select=*&order=created_at.desc`,
    {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  )
  const data = await sbRes.json()
  res.status(200).json(Array.isArray(data) ? data : [])
}
