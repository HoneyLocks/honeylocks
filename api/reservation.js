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

  const { nom, prenom, email, service, date_rdv, heure_rdv, prix, acompte } = req.body
  const prixStr = prix ? prix.toString().replace('€', '').trim() : null
  const prixNum = parseFloat(prixStr) || 0
  const acompteNum = parseFloat(acompte) || 0
  const resteNum = Math.max(0, prixNum - acompteNum)

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
      date_rdv: date_rdv || null,
      heure_rdv: heure_rdv || null,
      prix: prixStr,
      statut: 'confirmé',
      acompte_paye: false
    })
  })
  const sbData = await sbRes.json()
  console.log('Supabase reservation INSERT status:', sbRes.status)
  console.log('Supabase reservation INSERT response:', JSON.stringify(sbData))

  // Envoyer email de confirmation via Resend
  try {
    const info = await makeTransport().sendMail({
      from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
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
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prix total</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#c9a84c"><strong>${prixNum}€</strong></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Acompte payé</strong></td><td style="padding:8px;border-bottom:1px solid #eee">−${acompteNum}€</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Reste le jour J</strong></td><td style="padding:8px;border-bottom:1px solid #eee;font-size:17px"><strong>${resteNum}€</strong></td></tr>
          </table>
          <p style="margin-top:16px">💵 Paiement le jour J en <strong>espèces uniquement</strong>.</p>
          <p>⚠️ L'acompte versé est <strong>non remboursable</strong>.</p>
          <p>Tu recevras l'adresse du salon la veille de ton rendez-vous.</p>
          <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
        </div>
      `
    })
    console.log('Email sent:', info.messageId)
  } catch (e) {
    console.error('Email error:', e.message)
  }

  try {
    await makeTransport().sendMail({
      from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: '🔔 Nouvelle réservation — ' + (nom || email),
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
          <h2 style="color:#c9a84c">Nouvelle réservation 🍯</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Instagram</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${nom || '—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${email}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${service || '—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${date_rdv || '—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Heure</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${heure_rdv || '—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prix total</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${prixNum}€</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Acompte</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${acompteNum}€</td></tr>
          </table>
        </div>
      `
    })
  } catch (e) {
    console.error('Notif email error:', e.message)
  }

  res.status(200).json({ success: true })
}
