const nodemailer = require('nodemailer')

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })
}

function htmlPage(title, body) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Honey Locks</title>
<style>body{font-family:sans-serif;background:#161616;color:#f5e9c8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box}
.box{max-width:420px;text-align:center}.logo{color:#c9a84c;font-size:1.8rem;font-weight:700;margin-bottom:8px}
h1{color:#c9a84c;font-size:1.2rem;margin:16px 0 10px}p{color:rgba(245,233,200,.65);font-size:14px;line-height:1.7}
a{display:inline-block;margin-top:22px;background:#c9a84c;color:#161616;padding:12px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px}</style>
</head><body><div class="box"><div class="logo">Honey Locks 🍯</div><h1>${title}</h1><p>${body}</p>
<a href="https://honeylocks.fr">Retour au site</a></div></body></html>`
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET : annulation via lien email (token dans query) ──
  if (req.method === 'GET') {
    const token = req.query && req.query.token
    if (!token) {
      return res.status(400).send(htmlPage('Lien invalide', 'Ce lien d\'annulation est invalide.'))
    }

    const searchRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?token_annulation=eq.${encodeURIComponent(token)}&select=*`,
      { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` } }
    )
    const rows = await searchRes.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).send(htmlPage('Lien invalide', 'Ce lien d\'annulation est invalide ou a déjà été utilisé.'))
    }

    const rdv = rows[0]

    if (rdv.statut === 'annulé') {
      return res.status(200).send(htmlPage('Déjà annulé', 'Ce rendez-vous a déjà été annulé.'))
    }

    // Mettre à jour le statut
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?token_annulation=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        },
        body: JSON.stringify({ statut: 'annulé' })
      }
    )

    const transport = makeTransport()
    const slotLabel = rdv.date_rdv ? (rdv.date_rdv + (rdv.heure_rdv ? ' à ' + rdv.heure_rdv : '')) : ''

    // Mail à la cliente
    if (rdv.cliente_email) {
      try {
        await transport.sendMail({
          from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
          to: rdv.cliente_email,
          subject: '❌ Ton rendez-vous a été annulé — Honey Locks',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
              <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
              <p>Bonjour <strong>${rdv.cliente_nom || 'Chère cliente'}</strong>,</p>
              <p>Ton rendez-vous${slotLabel ? ' du <strong>' + slotLabel + '</strong>' : ''}${rdv.service ? ' pour <strong>' + rdv.service + '</strong>' : ''} a bien été annulé.</p>
              <p>⚠️ L'acompte versé est <strong>non remboursable</strong>.</p>
              <p>Pour reprendre rendez-vous :</p>
              <a href="https://honeylocks.fr" style="display:inline-block;background:#c9a84c;color:#161616;padding:13px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:15px;margin:8px 0">Réserver sur Honey Locks →</a>
              <p style="color:#999;font-size:12px;margin-top:16px">Honey Locks · Lyon · Disponible 7j/7</p>
            </div>
          `
        })
      } catch (e) { console.error('Annulation email cliente:', e.message) }
    }

    // Notification à Maïna
    try {
      await transport.sendMail({
        from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: '🚫 Annulation RDV — ' + (rdv.cliente_nom || rdv.cliente_email || 'Cliente'),
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
            <h2 style="color:#c9a84c">Annulation de rendez-vous 🚫</h2>
            <p>Une cliente a annulé son RDV via le lien email.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Cliente</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.cliente_nom || '—'}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.cliente_email || '—'}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.service || '—'}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${slotLabel || '—'}</td></tr>
            </table>
            <p style="color:#999;font-size:12px;margin-top:16px">Honey Locks · Lyon · Disponible 7j/7</p>
          </div>
        `
      })
    } catch (e) { console.error('Annulation notif Maïna:', e.message) }

    return res.status(200).send(htmlPage(
      'Rendez-vous annulé',
      'Ton rendez-vous a bien été annulé. Tu recevras un email de confirmation.<br><br>⚠️ L\'acompte versé est non remboursable.'
    ))
  }

  // ── POST : annulation depuis l'admin (comportement existant) ──
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nom, email, service, slot } = req.body
  if (!email) return res.status(400).json({ error: 'email requis' })

  try {
    await makeTransport().sendMail({
      from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '❌ Ton rendez-vous a été annulé — Honey Locks',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
          <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
          <p>Bonjour <strong>${nom || 'Chère cliente'}</strong>,</p>
          <p>Ton rendez-vous <strong>${slot ? 'du ' + slot : ''}</strong>${service ? ' pour <strong>' + service + '</strong>' : ''} a été annulé.</p>
          <p>Si tu souhaites reprendre rendez-vous, c'est par ici :</p>
          <a href="https://honeylocks.fr" style="display:inline-block;background:#c9a84c;color:#161616;padding:13px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:15px;margin:8px 0">Réserver sur Honey Locks →</a>
          <p style="color:#999;font-size:12px;margin-top:16px">Honey Locks · Lyon · Disponible 7j/7</p>
        </div>
      `
    })
    res.status(200).json({ success: true })
  } catch (e) {
    console.error('Annulation email error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
