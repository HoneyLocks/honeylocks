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
  const sbHeaders = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
  }

  // Chargement à la demande des photos d'une seule demande (évite de renvoyer
  // des dizaines de Mo de base64 à chaque ouverture de l'admin). Le bucket
  // photo-devis est public : les entrées uploadées avec succès sont déjà
  // des URLs complètes, pas besoin de les retraiter.
  if (id && req.query.photos) {
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?id=eq.${id}&statut=eq.devis&select=notes`,
      { headers: sbHeaders }
    )
    const rows = await sbRes.json()
    let photos = []
    try {
      const noteObj = JSON.parse((Array.isArray(rows) && rows[0] && rows[0].notes) || '{}')
      photos = Array.isArray(noteObj.photos) ? noteObj.photos : []
    } catch (e) {}
    return res.status(200).json({ photos })
  }

  // Retire les photos (souvent en base64, plusieurs centaines de Ko chacune)
  // avant de renvoyer une ligne au client : elles restent en base (jamais
  // supprimées), seul le compte est gardé. Les photos se chargent à la
  // demande via ?id=...&photos=1
  function stripPhotos(row) {
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
  }

  // Recherche serveur (nom Instagram ou email) sur l'ensemble des devis —
  // ne dépend pas de la pagination, donc retrouve aussi les devis déjà
  // archivés dans les pages non chargées.
  if (req.query.search) {
    const term = req.query.search.replace(/[,()]/g, '')
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.devis&or=(cliente_nom.ilike.*${encodeURIComponent(term)}*,cliente_email.ilike.*${encodeURIComponent(term)}*)&select=*&order=created_at.desc&limit=100`,
      { headers: sbHeaders }
    )
    const data = await sbRes.json()
    return res.status(200).json({ results: (Array.isArray(data) ? data : []).map(stripPhotos) })
  }

  // Chargement paginé : les devis en attente (peu nombreux, ce sont ceux qui
  // demandent une action) sont toujours renvoyés en entier ; les devis déjà
  // traités (le gros du volume historique) sont paginés pour éviter de
  // retransférer des dizaines de Mo de base64 à chaque ouverture de l'admin.
  if (req.query.quotedOffset !== undefined) {
    const quotedOffset = parseInt(req.query.quotedOffset) || 0
    const quotedLimit = parseInt(req.query.quotedLimit) || 20

    const surDevis = encodeURIComponent('sur devis')
    const [pendingRes, quotedRes] = await Promise.all([
      fetch(
        `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.devis&prix=eq.${surDevis}&select=*&order=created_at.desc`,
        { headers: sbHeaders }
      ),
      fetch(
        `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.devis&prix=neq.${surDevis}&select=*&order=created_at.desc&offset=${quotedOffset}&limit=${quotedLimit}`,
        { headers: Object.assign({ 'Prefer': 'count=exact' }, sbHeaders) }
      )
    ])
    const pending = await pendingRes.json()
    const quoted = await quotedRes.json()
    const contentRange = quotedRes.headers.get('content-range') || ''
    const quotedTotal = parseInt(contentRange.split('/')[1]) || (Array.isArray(quoted) ? quoted.length : 0)

    return res.status(200).json({
      pending: (Array.isArray(pending) ? pending : []).map(stripPhotos),
      quoted: (Array.isArray(quoted) ? quoted : []).map(stripPhotos),
      quotedTotal
    })
  }

  // Comportement historique inchangé : liste complète en un seul tableau
  // (utilisé par les scripts de maintenance cleanup_all.js / cleanup_test_devis.js /
  // audit_honeylocks.js, qui attendent un tableau brut).
  const sbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.devis&select=*&order=created_at.desc`,
    { headers: sbHeaders }
  )
  const data = await sbRes.json()
  res.status(200).json((Array.isArray(data) ? data : []).map(stripPhotos))
}
