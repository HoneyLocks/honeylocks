// Endpoint temporaire de test — à supprimer après usage
module.exports = async (req, res) => {
  if (req.query.secret !== 'honey2024') return res.status(403).json({ error: 'forbidden' })
  const email = req.query.email
  if (!email) return res.status(400).json({ error: 'email requis' })
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=eq.${encodeURIComponent(email)}&statut=eq.confirmé&select=token_annulation,date_rdv,heure_rdv&order=created_at.desc&limit=1`,
    { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` } }
  )
  const data = await r.json()
  res.status(200).json(data)
}
