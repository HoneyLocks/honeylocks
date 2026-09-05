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

  // Diagnostic temporaire : vérifie la clé service_role et tente un vrai
  // upload de test pour voir l'erreur exacte renvoyée par Supabase Storage.
  if (req.query && req.query.debug === 'storage') {
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    let role = 'inconnu'
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'))
      role = payload.role || 'inconnu'
    } catch (e) { role = 'pas un JWT (format sb_... ou autre ?)' }
    const usingServiceKey = !!process.env.SUPABASE_SERVICE_KEY
    const keyMeta = {
      length: key ? key.length : 0,
      prefix: key ? key.slice(0, 12) : null,
      dotCount: key ? (key.match(/\./g) || []).length : 0
    }
    const testRes = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/photos-devis/debug-test.txt`,
      {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'text/plain', 'x-upsert': 'true' },
        body: 'debug'
      }
    )
    const testBody = await testRes.text().catch(() => '')

    // Liste tous les buckets vus par cette clé, pour ce SUPABASE_URL précis
    const bucketsRes = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    const bucketsBody = await bucketsRes.text().catch(() => '')

    return res.status(200).json({
      supabaseUrl: process.env.SUPABASE_URL,
      usingServiceKey, jwtRole: role, keyMeta,
      uploadStatus: testRes.status, uploadBody: testBody,
      bucketsStatus: bucketsRes.status, bucketsBody: bucketsBody
    })
  }

  const id = req.query && req.query.id

  // Chargement à la demande des photos d'une seule demande (évite de renvoyer
  // des dizaines de Mo de base64 à chaque ouverture de l'admin)
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
    let rawPhotos = []
    try {
      const noteObj = JSON.parse((Array.isArray(rows) && rows[0] && rows[0].notes) || '{}')
      rawPhotos = Array.isArray(noteObj.photos) ? noteObj.photos : []
    } catch (e) {}

    // Le bucket "photos-devis" est privé : les entrées uploadées avec succès
    // ne contiennent qu'un chemin de fichier (ex: "devis-123-0.jpg"), il faut
    // une URL signée pour les afficher. Les anciennes entrées en base64
    // ("data:...") ou déjà en URL complète ("http...") sont renvoyées telles quelles.
    const storageKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    const photos = await Promise.all(rawPhotos.map(async p => {
      if (!p || p.startsWith('data:') || p.startsWith('http')) return p
      try {
        const signRes = await fetch(
          `${process.env.SUPABASE_URL}/storage/v1/object/sign/photos-devis/${p}`,
          {
            method: 'POST',
            headers: {
              'apikey': storageKey,
              'Authorization': `Bearer ${storageKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ expiresIn: 3600 })
          }
        )
        const signData = await signRes.json()
        if (signRes.ok && signData.signedURL) {
          return `${process.env.SUPABASE_URL}/storage/v1${signData.signedURL}`
        }
        console.error('[admin-devis] signature URL échouée pour', p, signRes.status, JSON.stringify(signData))
      } catch (e) {
        console.error('[admin-devis] erreur signature URL:', e.message)
      }
      return p
    }))

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
