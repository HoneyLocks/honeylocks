module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  const { secret } = req.body || {}
  if (secret !== 'honey-cleanup-2026') return res.status(403).json({ error: 'forbidden' })

  const BASE = process.env.SUPABASE_URL + '/rest/v1/reservations'
  const HEADERS = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
  }

  const results = []

  // D'abord lister ce qu'on va supprimer
  const listRes = await fetch(`${BASE}?select=id,cliente_nom,cliente_email,statut`, { headers: HEADERS })
  const listData = await listRes.json()
  console.log('[cleanup] toutes les réservations:', JSON.stringify(listData))

  // Supprimer les enregistrements de test un par un (filtre sur nom exact ou pattern)
  const testNoms = [
    'test_rappel test_rappel',
    'test_admin_mail test_admin_mail',
    'test_complet test_complet',
    'flow_test flow_test',
    'test_final2 test_final2',
    'test_devis2 test_devis2',
    'test_devis3 test_devis3',
    'test_devis_final test_devis_final',
    'test_devis_x test_devis_x',
    'test_devis test_devis',
  ]

  for (const nom of testNoms) {
    const url = `${BASE}?cliente_nom=eq.${encodeURIComponent(nom)}`
    const r = await fetch(url, { method: 'DELETE', headers: HEADERS })
    const body = await r.text()
    results.push({ nom, status: r.status, body: body.slice(0, 100) })
  }

  // Supprimer aussi par email test
  const r2 = await fetch(`${BASE}?cliente_email=eq.test%40test.com`, { method: 'DELETE', headers: HEADERS })
  results.push({ email: 'test@test.com', status: r2.status })

  res.status(200).json({ total_before: listData.length, deleted: results })
}
