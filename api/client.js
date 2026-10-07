module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const email = req.query.email
  if (!email) return res.status(400).json({ error: 'Email requis' })

  // ?upcoming=1 : réservations confirmées de cet email dans les 30 prochains jours
  if (req.query.upcoming) {
    try {
      const parisIso = d => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
      const now = new Date()
      const from = parisIso(now)
      const to = parisIso(new Date(now.getTime() + 30 * 24 * 3600 * 1000))
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=ilike.${encodeURIComponent(email.trim().toLowerCase())}&statut=eq.confirm%C3%A9&date_rdv=gte.${from}&date_rdv=lte.${to}&select=date_rdv,heure_rdv,notes,service&order=date_rdv.asc,heure_rdv.asc`,
        { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` } }
      )
      const rows = await r.json()
      const bookings = (Array.isArray(rows) ? rows : []).map(row => {
        let notes = {}
        try { notes = JSON.parse(row.notes || '{}') || {} } catch (e) {}
        const acompte = parseFloat(notes.acompte)
        return { date_rdv: row.date_rdv, heure_rdv: row.heure_rdv, acompte: acompte > 0 ? acompte : 20 }
      })
      return res.status(200).json({ bookings })
    } catch (e) {
      console.error('client.js upcoming error:', e)
      return res.status(200).json({ bookings: [] })
    }
  }

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=ilike.${encodeURIComponent(email.toLowerCase())}&statut=eq.devis&select=*&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      }
    )

    const data = await response.json()

    if (Array.isArray(data) && data.length > 0) {
      const rdv = data[0]
      const prixRaw = rdv.prix
      const prix = prixRaw != null ? parseFloat(prixRaw.toString().replace('€', '').trim()) : NaN

      if (!isNaN(prix) && prix > 0) {
        return res.status(200).json({
          name: rdv.cliente_nom ? rdv.cliente_nom.trim().split(' ')[0] : email.split('@')[0],
          price: prix,
          service: rdv.service || null
        })
      }

      // Devis soumis mais pas encore chiffré
      return res.status(200).json({ pending: true })
    }

    res.status(200).json({ found: false })
  } catch (e) {
    console.error('client.js error:', e)
    res.status(200).json({ found: false })
  }
}
