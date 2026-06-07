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

  const { nom, email, service, slot, acompte } = req.body
  if (!email) return res.status(400).json({ error: 'email requis' })

  try {
    const info = await makeTransport().sendMail({
      from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '⚠️ Acompte non reçu — ton créneau est en attente',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
          <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
          <p>Bonjour <strong>${nom || 'Chère cliente'}</strong>,</p>
          <p>Ton créneau <strong>${slot || ''}</strong> pour <strong>${service || ''}</strong> est bien enregistré, mais <strong>ton acompte de ${acompte || '5'}€ n'a pas encore été reçu</strong>.</p>
          <div style="background:#fff8e1;border-left:4px solid #c9a84c;padding:14px 16px;border-radius:0 8px 8px 0;margin:20px 0">
            ⚠️ <strong>Sans paiement dans les 24h, ton créneau sera annulé et remis à disposition.</strong>
          </div>
          <p>Pour régler ton acompte maintenant :</p>
          <a href="https://www.paypal.me/loveloveleM/${acompte || '5'}" style="display:inline-block;background:#c9a84c;color:#161616;padding:13px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:15px;margin:8px 0">Payer ${acompte || '5'}€ sur PayPal →</a>
          <p style="margin-top:18px;font-size:13px;color:#666">💬 Pense à indiquer ton nom Instagram et la date du créneau en description du paiement PayPal.</p>
          <p style="font-size:13px;color:#666">En cas de question, réponds simplement à ce mail.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
        </div>
      `
    })
    console.log('Rappel acompte sent:', info.messageId)
    res.status(200).json({ success: true })
  } catch (e) {
    console.error('Rappel email error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
