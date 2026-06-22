module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { booking_id, paid } = req.body
  if (!booking_id) return res.status(400).json({ error: 'booking_id requis' })

  const patchRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?id=eq.${booking_id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      },
      body: JSON.stringify({ acompte_paye: paid === true || paid === 'true' })
    }
  )
  console.log('[acompte] PATCH id=', booking_id, 'paid=', paid, 'status=', patchRes.status)
  res.status(patchRes.ok ? 200 : 500).json({ success: patchRes.ok })
}
