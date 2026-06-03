module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const email = req.query.email
  if (!email) return res.status(400).json({ error: 'Email requis' })

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=eq.${encodeURIComponent(email)}&statut=eq.devis&select=*&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  )

  const data = await response.json()

  if (data && data.length > 0 && data[0].prix) {
    const rdv = data[0]
    const prix = parseFloat(rdv.prix.toString().replace('€','').trim())
    res.status(200).json({
      name: rdv.cliente_nom ? rdv.cliente_nom.split(' ')[0] : email.split('@')[0],
      price: prix
    })
  } else {
    res.status(200).json({ found: false })
  }
}
