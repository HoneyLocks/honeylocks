const nodemailer = require('nodemailer')

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })
}

// Construit une date iCal (YYYYMMDDTHHMMSS) à partir de "2026-06-08" + "10:30"
function icsDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const d = dateStr.replace(/-/g, '')           // "20260608"
  const t = timeStr.replace(':', '') + '00'      // "103000"
  return d + 'T' + t
}

function buildIcs({ uid, summary, description, dtstart, dtend }) {
  // Lignes iCal séparées par CRLF, encodage UTF-8
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Honey Locks//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + dtstart,
    'DTSTART:' + dtstart,
    'DTEND:' + dtend,
    'SUMMARY:' + summary,
    'DESCRIPTION:' + description,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
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

  // Email de confirmation à la cliente
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
          <div style="margin-top:20px;background:#fff8e1;border-left:4px solid #c9a84c;border-radius:0 8px 8px 0;padding:14px 16px">
            <p style="margin:0 0 8px;font-weight:700;color:#7a5c00;font-size:13px">📋 Consignes importantes</p>
            <ul style="margin:0;padding-left:18px;color:#555;font-size:12.5px;line-height:1.9">
              <li>Cheveux propres et démêlés obligatoires le jour J</li>
              <li>Si brushing non pris et cheveux non étirés : supplément de 10€ facturé</li>
              <li>Retard de plus de 20 min : supplément de 10€ facturé</li>
              <li>Retard de plus de 30 min : rendez-vous annulé, acompte non remboursé</li>
              <li>Cheveux sales ou non démêlés : prestation annulée, acompte non remboursé</li>
            </ul>
          </div>
          <p style="color:#999;font-size:12px;margin-top:16px">Honey Locks · Lyon · Disponible 7j/7</p>
        </div>
      `
    })
    console.log('Email sent:', info.messageId)
  } catch (e) {
    console.error('Email error:', e.message)
  }

  // Notification à Maïna avec pièce jointe .ics
  try {
    const dtstart = icsDate(date_rdv, heure_rdv)

    // Calcul DTEND = DTSTART + 2h
    let dtend = dtstart
    if (dtstart) {
      const [datePart, timePart] = [dtstart.slice(0, 8), dtstart.slice(9, 15)]
      const h = parseInt(timePart.slice(0, 2), 10) + 2
      dtend = datePart + 'T' + String(h).padStart(2, '0') + timePart.slice(2)
    }

    const uid = 'honeylocks-' + Date.now() + '@honeylocks.vercel.app'
    const clientLabel = nom ? '@' + nom : (email || 'Cliente')
    const icsContent = dtstart ? buildIcs({
      uid,
      summary: (service || 'RDV') + ' — ' + clientLabel,
      description: 'Cliente : ' + clientLabel + '\\nEmail : ' + (email || '—') + '\\nPrix : ' + prixNum + '€\\nAcompte : ' + acompteNum + '€',
      dtstart,
      dtend,
    }) : null

    const mailOpts = {
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
          ${icsContent ? '<p style="margin-top:16px;font-size:13px;color:#666">📅 Pièce jointe .ics — ouvre-la pour ajouter le RDV à ton calendrier.</p>' : ''}
        </div>
      `,
    }

    if (icsContent) {
      mailOpts.attachments = [{
        filename: 'rdv-honeylocks.ics',
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      }]
    }

    await makeTransport().sendMail(mailOpts)
  } catch (e) {
    console.error('Notif email error:', e.message)
  }

  res.status(200).json({ success: true })
}
