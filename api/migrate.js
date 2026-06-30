module.exports = async (req, res) => {
  if (req.query.secret !== 'honey2024') return res.status(403).end()

  // Extract project ref from SUPABASE_URL (https://{ref}.supabase.co)
  const url = process.env.SUPABASE_URL || ''
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (!match) return res.status(500).json({ error: 'SUPABASE_URL invalide', url })

  const ref = match[1]
  const pat = process.env.SUPABASE_PAT

  if (!pat) {
    // Try to create via direct Supabase REST — will fail for DDL but lets us detect
    const check = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/slots_config?limit=1`,
      {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      }
    )
    if (check.ok) return res.status(200).json({ already_exists: true })
    return res.status(500).json({
      error: 'SUPABASE_PAT manquant. Ajoute ton token Supabase personnel comme variable SUPABASE_PAT dans Vercel.',
      hint: 'Va sur supabase.com → Account → Access Tokens → Generate new token',
      project_ref: ref
    })
  }

  // Use Supabase Management API to run SQL
  const sql = `
    CREATE TABLE IF NOT EXISTS slots_config (
      date date PRIMARY KEY,
      slots jsonb NOT NULL DEFAULT '[]'::jsonb
    );
  `

  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    }
  )

  const result = await r.text()
  console.log('[migrate] status=', r.status, 'body=', result)

  if (r.ok) return res.status(200).json({ success: true, message: 'Table slots_config créée.' })
  return res.status(500).json({ error: 'Échec', status: r.status, body: result })
}
