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

  const id = req.query && req.query.id

  // Chargement à la demande des photos d'une seule demande (évite de renvoyer
  // des dizaines de Mo de base64 à chaque ouverture de l'admin). Le bucket
  // photo-devis est public : les entrées uploadées avec succès sont déjà
  // des URLs complètes, pas besoin de les retraiter.
  if (id && req.query.photos) {
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?id=eq.${id}&statut=eq.devis&select=notes`,
      {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      }
    )
    const rows = await sbRes.json()
    let photos = []
    try {
      const noteObj = JSON.parse((Array.isArray(rows) && rows[0] && rows[0].notes) || '{}')
      photos = Array.isArray(noteObj.photos) ? noteObj.photos : []
    } catch (e) {}
    return res.status(200).json({ photos })
  }

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

  // On retire les photos (souvent en base64, plusieurs centaines de Ko chacune)
  // de la liste : elles font passer la réponse à plusieurs dizaines de Mo et
  // gèlent l'admin. On ne garde que le compte, les photos sont chargées à la
  // demande via ?id=...&photos=1
  const stripped = (Array.isArray(data) ? data : []).map(row => {
    let notes = row.notes
    let photoCount = 0
    try {
      const noteObj = JSON.parse(notes || '{}')
      if (Array.isArray(noteObj.photos)) {
        photoCount = noteObj.photos.length
        notes = JSON.stringify({ message: noteObj.message || null })
      }
    } catch (e) {}
    return Object.assign({}, row, { notes, photoCount })
  })

  res.status(200).json(stripped)
}
