module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nom, prenom, email, service, prix, message } = req.body
  const prixNum = prix ? parseFloat(prix.toString().replace('€', '').trim()) : null

  // Sauvegarder dans Supabase via REST
  const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      cliente_email: email,
      cliente_nom: (nom || '') + ' ' + (prenom || ''),
      service: service,
      prix: isNaN(prixNum) ? null : prixNum,
      statut: 'devis'
    })
  })

  const sbData = await sbRes.json()
  console.log('Supabase INSERT status:', sbRes.status)
  console.log('Supabase INSERT response:', JSON.stringify(sbData))

  if (sbRes.status >= 400) {
    return res.status(500).json({ error: 'Supabase insert failed', detail: sbData })
  }

  // Envoyer email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: email,
      subject: '🍯 Ton devis Honey Locks',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
          <p>Bonjour ${prenom || nom},</p>
          <p>Voici le prix pour ta prestation :</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${service}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prix</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#c9a84c;font-size:18px"><strong>${prix}</strong></td></tr>
          </table>
          ${message ? `<p style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:8px">${message}</p>` : ''}
          <p style="margin-top:20px">Pour confirmer ton rendez-vous, reviens sur le site et choisis ton créneau.</p>
          <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
        </div>
      `
    })
  })

  const result = await emailRes.json()
  console.log('Resend result:', JSON.stringify(result))

  res.status(200).json({ success: true })
}
