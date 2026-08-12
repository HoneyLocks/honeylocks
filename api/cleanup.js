module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const headers = {
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }

  const mode = (req.query && req.query.mode) || 'old'

  if (mode === 'all') {
    // Supprime TOUTES les réservations — usage test uniquement
    const beforeR = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations?select=id`, { headers })
    const before = await beforeR.json()
    const totalBefore = Array.isArray(before) ? before.length : 0
    if (totalBefore === 0) return res.status(200).json({ deleted: 0, remaining: 0 })

    const delR = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations?id=gte.0`, { method: 'DELETE', headers })
    const deleted = await delR.json()

    const afterR = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations?select=id`, { headers })
    const after = await afterR.json()

    return res.status(200).json({
      deleted: Array.isArray(deleted) ? deleted.length : totalBefore,
      remaining: Array.isArray(after) ? after.length : -1
    })
  }

  // mode par défaut 'old' : supprime les réservations confirmées passées (même logique que rappels.js)
  const today = new Date().toISOString().split('T')[0]
  const delRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.confirmé&date_rdv=lt.${today}`,
    { method: 'DELETE', headers }
  )
  const deleted = await delRes.json()
  const count = Array.isArray(deleted) ? deleted.length : 0

  console.log(`[cleanup] mode=old ${today} — ${count} réservation(s) passée(s) supprimée(s)`)
  res.status(200).json({ success: true, deleted: count, before: today })
}
