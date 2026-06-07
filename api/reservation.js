module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nom, prenom, email, service, date_rdv, heure_rdv, prix } = req.body
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
      date_rdv: date_rdv,
      heure_rdv: heure_rdv,
      prix: isNaN(prixNum) ? null : prixNum,
      statut: 'confirmé',
      acompte_paye: false
    })
  })
  console.log('Supabase reservation INSERT status:', sbRes.status)
  console.log('Supabase reservation INSERT response:', JSON.stringify(await sbRes.json()))

  // Envoyer email de confirmation via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: email,
      subject: '✅ Rendez-vous confirmé — Honey Locks',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
          <p>Bonjour ${prenom || nom},</p>
          <p>Ton rendez-vous est confirmé !</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${service}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${date_rdv}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Heure</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${heure_rdv}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prix</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${prix}</td></tr>
          </table>
          <p style="margin-top:20px">⚠️ L'acompte versé est <strong>non remboursable</strong>.</p>
          <p>Tu recevras l'adresse du salon la veille de ton rendez-vous.</p>
          <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
        </div>
      `
    })
  })

  const result = await emailRes.json()
  console.log('Resend result:', JSON.stringify(result))

  res.status(200).json({ success: true })
}
