const nodemailer = require('nodemailer')

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'PATCH') {
    const { id, date_rdv, heure_rdv } = req.body
    if (!id || !date_rdv || !heure_rdv) return res.status(400).json({ error: 'id, date_rdv et heure_rdv requis' })

    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?id=eq.${id}&statut=eq.confirmé`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ date_rdv, heure_rdv })
      }
    )
    const sbData = await sbRes.json()
    const row = Array.isArray(sbData) ? sbData[0] : null
    if (!row) return res.status(500).json({ error: 'Réservation introuvable ou non mise à jour' })

    if (row.cliente_email) {
      const transport = makeTransport()
      await transport.sendMail({
        from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
        to: row.cliente_email,
        subject: '📅 Ton rendez-vous a été modifié — Honey Locks',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
            <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
            <p>Bonjour ${row.cliente_nom || 'Cliente'},</p>
            <p>Ton rendez-vous a été modifié. Nouveau créneau : <strong>${date_rdv}</strong> à <strong>${heure_rdv}</strong> 🍯</p>
            <p style="color:#999;font-size:12px;margin-top:16px">Honey Locks · Lyon · Disponible 7j/7</p>
          </div>
        `
      }).catch(e => console.error('[admin-bookings] email décalage erreur:', e.message))
    }

    return res.status(200).json({ success: true })
  }

  if (req.method !== 'GET') return res.status(405).end()

  const sbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/reservations?statut=eq.confirmé&select=*&order=date_rdv.asc,heure_rdv.asc`,
    {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  )
  const data = await sbRes.json()
  res.status(200).json(Array.isArray(data) ? data : [])
}
