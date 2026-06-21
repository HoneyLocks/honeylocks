const TEST_EMAILS = [
  'mainapadou971@gmail.com',
  'test@honeylocks.fr',
  'test@test.com',
  'demo@honeylocks.fr'
]

module.exports = async (req, res) => {
  const headers = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
  }

  const results = []

  for (const email of TEST_EMAILS) {
    const delR = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: { ...headers, 'Prefer': 'return=representation' } }
    )
    const deleted = await delR.json()
    const count = Array.isArray(deleted) ? deleted.length : 0
    if (count > 0) results.push({ email, deleted: count })
  }

  const afterR = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?select=id,cliente_email,statut`,
    { headers }
  )
  const remaining = await afterR.json()

  res.status(200).json({
    cleaned: results,
    total_deleted: results.reduce((s, r) => s + r.deleted, 0),
    remaining: Array.isArray(remaining) ? remaining.length : -1
  })
}
