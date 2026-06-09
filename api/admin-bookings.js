module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).end()

  const sbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.confirmé&select=*&order=date_rdv.asc,heure_rdv.asc`,
    {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  )
  const data = await sbRes.json()
  res.status(200).json(Array.isArray(data) ? data : [])
}
