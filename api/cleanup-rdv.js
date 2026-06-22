module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Aujourd'hui en UTC (même logique que rappels.js)
  const today = new Date().toISOString().split('T')[0]

  const headers = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }

  // Supprime directement en base toutes les réservations/devis dont date_rdv < aujourd'hui
  // statut=confirmé uniquement (les devis sans date ne sont pas touchés)
  const delRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.confirmé&date_rdv=lt.${today}`,
    { method: 'DELETE', headers }
  )

  const deleted = await delRes.json()
  const count = Array.isArray(deleted) ? deleted.length : 0

  console.log(`[cleanup-rdv] ${today} — ${count} réservation(s) passée(s) supprimée(s)`)
  res.status(200).json({ success: true, deleted: count, before: today })
}
