module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?id=gte.0`,
    {
      method: 'DELETE',
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  )
  res.status(200).json({ deleted: r.status })
}
