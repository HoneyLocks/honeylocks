const nodemailer = require('nodemailer')

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nom, prenom, email, service, prix, message } = req.body
  const prixStr = prix ? prix.toString().replace('€', '').trim() : null

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
      cliente_nom: ((nom || '') + ' ' + (prenom || '')).trim(),
      service: service,
      prix: prixStr,
      statut: 'devis'
    })
  })

  const sbData = await sbRes.json()
  console.log('Supabase INSERT status:', sbRes.status)
  console.log('Supabase INSERT response:', JSON.stringify(sbData))

  if (sbRes.status >= 400) {
    return res.status(500).json({ error: 'Supabase insert failed', detail: sbData })
  }

  const prenom_ = prenom || nom || 'toi'
  const isQuote = prixStr && !isNaN(parseFloat(prixStr))

  const htmlBody = isQuote
    ? `<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
        <p>Bonjour ${prenom_},</p>
        <p>Voici ton devis personnalisé :</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${service}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prix</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#c9a84c;font-size:18px"><strong>${prixStr}€</strong></td></tr>
        </table>
        ${message ? `<p style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:8px">${message}</p>` : ''}
        <p style="margin-top:20px">Maintenant que tu as ton devis, tu peux réserver ton créneau directement ici 👉 <a href="https://honeylocks.vercel.app">https://honeylocks.vercel.app</a></p>
        <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
        <p>Bonjour ${prenom_},</p>
        <p>Ta demande de devis a bien été envoyée ! Tu recevras ton devis très rapidement. Pense à vérifier tes spams 🍯</p>
        <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
      </div>`

  try {
    const info = await makeTransport().sendMail({
      from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: isQuote ? '🍯 Ton devis Honey Locks' : '🍯 Demande reçue — Honey Locks',
      html: htmlBody
    })
    console.log('Email sent:', info.messageId)
  } catch (e) {
    console.error('Email error:', e.message)
  }

  res.status(200).json({ success: true })
}
