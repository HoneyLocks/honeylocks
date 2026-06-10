module.exports = async (req, res) => {
  // Lire d'abord pour connaître les IDs
  const getR = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations?select=id,statut`, {
    headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }
  })
  const rows = await getR.json()
  if (!Array.isArray(rows) || rows.length === 0) return res.status(200).json({ deleted: 0, total_before: 0 })

  // Supprimer par statut
  const delR = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations?statut=in.(confirmé,devis,pending)`, {
    method: 'DELETE',
    headers: {
      'apikey': process.env.SUPABASE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      'Prefer': 'return=representation'
    }
  })
  const deleted = await delR.json()

  // Vérifier après
  const afterR = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations?select=id`, {
    headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }
  })
  const after = await afterR.json()
  res.status(200).json({ total_before: rows.length, deleted: Array.isArray(deleted) ? deleted.length : deleted, remaining: Array.isArray(after) ? after.length : -1 })
}
