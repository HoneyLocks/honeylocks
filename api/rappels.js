const nodemailer = require('nodemailer')

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })
}

const CONSIGNES = `
  <div style="margin-top:20px;background:#fff8e1;border-left:4px solid #c9a84c;border-radius:0 8px 8px 0;padding:14px 16px">
    <p style="margin:0 0 8px;font-weight:700;color:#7a5c00;font-size:13px">📋 Consignes importantes</p>
    <ul style="margin:0;padding-left:18px;color:#555;font-size:12.5px;line-height:1.9">
      <li>Cheveux propres et démêlés obligatoires le jour J</li>
      <li>Si brushing non pris et cheveux non étirés : supplément de 10€ facturé</li>
      <li>Retard de plus de 15 min : le créneau peut être annulé</li>
      <li>Cheveux sales ou non démêlés : prestation annulée, acompte non remboursé</li>
    </ul>
  </div>
`

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const demain = new Date()
  demain.setDate(demain.getDate() + 1)
  const dateDemain = demain.toISOString().split('T')[0]

  // Récupérer les réservations de demain
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?date_rdv=eq.${dateDemain}&statut=eq.confirmé&select=*`,
    {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  )

  const reservations = await response.json()

  if (!reservations || reservations.length === 0) {
    return res.status(200).json({ message: 'Aucun rappel à envoyer' })
  }

  const transport = makeTransport()
  let envoyes = 0

  for (const rdv of reservations) {
    if (!rdv.cliente_email) continue
    try {
      await transport.sendMail({
        from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
        to: rdv.cliente_email,
        subject: '⏰ Rappel — Ton rendez-vous Honey Locks demain',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
            <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
            <p>Bonjour ${rdv.cliente_nom || 'Chère cliente'},</p>
            <p>Rappel : tu as rendez-vous <strong>demain</strong> !</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.service || '—'}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.date_rdv || '—'}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Heure</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.heure_rdv || '—'}</td></tr>
            </table>
            <p style="margin-top:16px">⚠️ L'acompte versé est <strong>non remboursable</strong>.</p>
            <p style="font-size:13px;color:#666">L'adresse du salon te sera communiquée aujourd'hui.</p>
            ${CONSIGNES}
            <p style="color:#999;font-size:12px;margin-top:16px">Honey Locks · Lyon · Disponible 7j/7</p>
          </div>
        `
      })
      envoyes++
    } catch (e) {
      console.error('Rappel error for', rdv.cliente_email, ':', e.message)
    }
  }

  res.status(200).json({ success: true, rappels_envoyes: envoyes })
}
