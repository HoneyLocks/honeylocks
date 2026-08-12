module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/evenements_perso?select=*&order=date_evt.asc,heure_evt.asc`,
      {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      }
    )
    const data = await sbRes.json()
    return res.status(200).json(Array.isArray(data) ? data : [])
  }

  if (req.method === 'POST') {
    const { titre, date_evt, heure_evt, couleur } = req.body || {}
    if (!titre || !date_evt) return res.status(400).json({ error: 'titre et date_evt requis' })

    const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/evenements_perso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        titre: titre,
        date_evt: date_evt,
        heure_evt: heure_evt || null,
        couleur: couleur || '#5BA873'
      })
    })
    const data = await sbRes.json()
    if (sbRes.status >= 400) return res.status(500).json({ error: 'Supabase insert failed', detail: data })
    return res.status(200).json(Array.isArray(data) ? data[0] : data)
  }

  if (req.method === 'DELETE') {
    const id = req.query && req.query.id
    if (!id) return res.status(400).json({ error: 'id requis' })
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/evenements_perso?id=eq.${id}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      }
    )
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
