module.exports = async (req, res) => {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations?id=gt.0`, {
    method: 'DELETE',
    headers: {
      'apikey': process.env.SUPABASE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      'Prefer': 'return=representation'
    }
  })
  const data = await r.json()
  res.status(200).json({ deleted: Array.isArray(data) ? data.length : data })
}
