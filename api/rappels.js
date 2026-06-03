const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Trouver les réservations de demain
  const demain = new Date()
  demain.setDate(demain.getDate() + 1)
  const dateDemain = demain.toISOString().split('T')[0]

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('date_rdv', dateDemain)
    .eq('statut', 'confirmé')

  if (error) return res.status(500).json({ error: error.message })
  if (!reservations || reservations.length === 0) return res.status(200).json({ message: 'Aucun rappel à envoyer' })

  // Envoyer un mail de rappel à chaque cliente
  for (const rdv of reservations) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: rdv.cliente_email,
        subject: '⏰ Rappel — Ton rendez-vous Honey Locks demain',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
            <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
            <p>Bonjour,</p>
            <p>Rappel : tu as rendez-vous <strong>demain</strong> !</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.service}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.date_rdv}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Heure</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${rdv.heure_rdv}</td></tr>
            </table>
            <div style="margin-top:20px;padding:16px;background:#fff8e7;border-radius:8px;border-left:4px solid #c9a84c">
              <strong>📍 Adresse :</strong><br>
              <span style="font-size:15px">À venir — tu recevras l'adresse exacte ici</span>
            </div>
            <p style="margin-top:16px">⚠️ L'acompte versé est <strong>non remboursable</strong>.</p>
            <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
          </div>
        `
      })
    })
  }

  res.status(200).json({ success: true, rappels_envoyes: reservations.length })
}
