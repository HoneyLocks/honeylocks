module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'PATCH') {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=eq.padouclemence%40gmail.com&statut=eq.devis`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }, body: JSON.stringify({ notes: '97 locks' }) }
    )
    return res.status(200).json({ status: r.status })
  }
  if (req.method !== 'GET') return res.status(405).end()

  const sbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.devis&select=*&order=created_at.desc`,
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
