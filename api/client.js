module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const email = req.query.email
  if (!email) return res.status(400).json({ error: 'Email requis' })

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=ilike.${encodeURIComponent(email.toLowerCase())}&select=*&order=created_at.desc&limit=1`,
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
      if (rdv.statut === 'devis') {
        return res.status(200).json({ pending: true })
      }
    }

    res.status(200).json({ found: false })
  } catch (e) {
    console.error('client.js error:', e)
    res.status(200).json({ found: false })
  }
}
