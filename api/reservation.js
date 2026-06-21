const nodemailer = require('nodemailer')

function generateToken() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

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
  return lines.join('\r\n') + '\r\n'
}

function buildServiceRows(service, baseService, baseSize, optsData) {
  const baseName = baseService || service
  const opts = []
  if (baseSize) opts.push({ name: baseSize, price: 0 })
  if (Array.isArray(optsData)) optsData.forEach(o => opts.push(o))

  const tdBase = 'padding:8px;border-bottom:1px solid #eee'
  let html = `<tr>
    <td style="${tdBase};vertical-align:top"><strong>Prestation</strong></td>
    <td style="${tdBase}">${baseName}</td>
  </tr>`

  opts.forEach((o, i) => {
    const isLast = i === opts.length - 1
    const pad = isLast ? '4px 8px 10px' : '2px 8px'
    const border = isLast ? '1px solid #eee' : 'none'
    const priceTag = o.price > 0 ? `+${o.price}€` : o.price < 0 ? `${o.price}€` : '+0€'
    html += `<tr>
      <td style="padding:${pad};border-bottom:${border}"></td>
      <td style="padding:${pad};border-bottom:${border};color:#555;font-size:13px">
        <span style="color:#c9a84c;font-weight:600">${priceTag}</span> ${o.name}
      </td>
    </tr>`
  })
  return html
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nom, prenom, email, service, date_rdv, heure_rdv, prix, acompte, baseService, baseSize, optsData, curPhotos, inspoPhotos } = req.body
  const token = generateToken()
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
      acompte_paye: false,
      token_annulation: token,
      notes: JSON.stringify({ baseService: baseService || null, baseSize: baseSize || null, opts: optsData || [], acompte: acompteNum })
    })
  })
  const sbData = await sbRes.json()
  console.log('Supabase reservation INSERT status:', sbRes.status)
  console.log('Supabase reservation INSERT response:', JSON.stringify(sbData))

  // Préparer les photos pour le mail Maïna
  const photosLocks = Array.isArray(curPhotos) && curPhotos.length
    ? `<p style="margin-top:16px;font-weight:600">🔒 Photos locks :</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${curPhotos.map(src => `<img src="${src}" style="width:160px;height:160px;object-fit:cover;border-radius:8px;border:1px solid #ddd">`).join('')}</div>`
    : ''
  const photosInspo = Array.isArray(inspoPhotos) && inspoPhotos.length
    ? `<p style="margin-top:14px;font-weight:600">💫 Photos inspiration :</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${inspoPhotos.map(src => `<img src="${src}" style="width:160px;height:160px;object-fit:cover;border-radius:8px;border:1px solid #ddd">`).join('')}</div>`
    : ''

  // ICS pour Maïna
  const dtstart = icsDate(date_rdv, heure_rdv)
  let dtend = dtstart
  if (dtstart) {
    const timePart = dtstart.slice(9, 15)
    const h = parseInt(timePart.slice(0, 2), 10) + 2
    dtend = dtstart.slice(0, 9) + String(h).padStart(2, '0') + timePart.slice(2)
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

  const notifMailOpts = {
    from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: '🔔 Nouvelle réservation — ' + (nom || email),
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
        <h2 style="color:#c9a84c">Nouvelle réservation 🍯</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Instagram</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${nom || '—'}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${email}</td></tr>
          ${buildServiceRows(service, baseService, baseSize, optsData)}
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${date_rdv || '—'}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Heure</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${heure_rdv || '—'}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prix total</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${prixNum}€</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Acompte</strong></td><td style="padding:8px;border-bottom:1px solid #eee">−${acompteNum}€</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Reste à payer le jour J</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#c9a84c;font-size:17px"><strong>${resteNum}€</strong></td></tr>
        </table>
        ${photosLocks}${photosInspo}
        ${icsContent ? '<p style="margin-top:16px;font-size:13px;color:#666">📅 Pièce jointe .ics — ouvre-la pour ajouter le RDV à ton calendrier.</p>' : ''}
      </div>
    `,
  }
  if (icsContent) {
    notifMailOpts.attachments = [{
      filename: 'rdv-honeylocks.ics',
      content: icsContent,
      contentType: 'application/octet-stream',
    }]
  }

  const transport = makeTransport()

  // Emails en parallèle (await — garantit l'envoi avant que Vercel ferme la Lambda)
  await Promise.all([
    transport.sendMail({
      from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '✅ Rendez-vous confirmé — Honey Locks',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
          <p>Bonjour ${prenom || nom},</p>
          <p>Ton rendez-vous est confirmé !</p>
          <table style="width:100%;border-collapse:collapse">
            ${buildServiceRows(service, baseService, baseSize, optsData)}
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${date_rdv}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Heure</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${heure_rdv}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prix total</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#c9a84c"><strong>${prixNum}€</strong></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Acompte payé</strong></td><td style="padding:8px;border-bottom:1px solid #eee">−${acompteNum}€</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Reste le jour J</strong></td><td style="padding:8px;border-bottom:1px solid #eee;font-size:17px"><strong>${resteNum}€</strong></td></tr>
          </table>
          <p style="margin-top:16px">💵 Paiement le jour J en <strong>espèces uniquement</strong>.</p>
          <p>⚠️ L'acompte versé est <strong>non remboursable</strong>.</p>
          <p>📍 L'adresse exacte du salon te sera envoyée par mail la veille de ton rendez-vous à 9h30.</p>
          <p style="margin-top:16px;font-size:13px;color:#888">Tu ne peux pas venir ? <a href="https://honeylocks.fr/api/annulation?token=${token}" style="color:#c9a84c">Annule ton rendez-vous ici</a> — ⚠️ L'acompte reste non remboursable.</p>
          <div style="margin-top:20px;background:#fff8e1;border-left:4px solid #c9a84c;border-radius:0 8px 8px 0;padding:14px 16px">
            <p style="margin:0 0 8px;font-weight:700;color:#7a5c00;font-size:13px">📋 Consignes importantes</p>
            <ul style="margin:0;padding-left:18px;color:#555;font-size:12.5px;line-height:1.9">
              <li>Cheveux propres et démêlés obligatoires le jour J</li>
              <li>Venir avec les cheveux secs sans produits (sans cire, huile ni crème)</li>
              <li>Si brushing non pris et cheveux non étirés : supplément de 10€ facturé</li>
              <li>Retard de plus de 20 min : supplément de 10€ facturé</li>
              <li>Retard de plus de 30 min : rendez-vous annulé, acompte non remboursé</li>
              <li>Cheveux sales ou non démêlés : prestation annulée, acompte non remboursé</li>
            </ul>
          </div>
          <p style="color:#999;font-size:12px;margin-top:16px">Honey Locks · Lyon · Disponible 7j/7</p>
        </div>
      `
    }).then(info => console.log('Email cliente envoyé:', info.messageId))
      .catch(e => console.error('Email cliente error:', e.message)),

    transport.sendMail(notifMailOpts)
      .then(() => console.log('Notif Maïna envoyée'))
      .catch(e => console.error('Notif email error:', e.message))
  ])

  res.status(200).json({ success: true })
}
