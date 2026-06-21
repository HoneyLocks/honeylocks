module.exports = async (req, res) => {
  const headers = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    'Prefer': 'return=representation'
  }

  // Compte avant
  const beforeR = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?select=id`,
    { headers }
  )
  const before = await beforeR.json()
  const totalBefore = Array.isArray(before) ? before.length : 0

  if (totalBefore === 0) return res.status(200).json({ deleted: 0, remaining: 0 })

  // Supprime tout
  const delR = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?id=gte.0`,
    { method: 'DELETE', headers }
  )
  const deleted = await delR.json()

  // Vérifie après
  const afterR = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?select=id`,
    { headers }
  )
  const after = await afterR.json()

  res.status(200).json({
    deleted: Array.isArray(deleted) ? deleted.length : totalBefore,
    remaining: Array.isArray(after) ? after.length : -1
  })
}
