const nodemailer = require('nodemailer')

function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })
}

// La clé service_role contourne les policies RLS de storage.objects.
// À défaut on retente avec SUPABASE_KEY (comportement inchangé).
const STORAGE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
const STORAGE_BUCKET = 'photo-devis'

async function uploadPhotoToStorage(base64, index) {
  if (!base64 || !base64.startsWith('data:')) return base64
  const match = base64.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return base64
  const mimeType = match[1]
  const ext = mimeType.split('/')[1] || 'jpg'
  const buf = Buffer.from(match[2], 'base64')
  const filename = `devis-${Date.now()}-${index}.${ext}`
  try {
    const uploadRes = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filename}`,
      {
        method: 'POST',
        headers: {
          'apikey': STORAGE_KEY,
          'Authorization': `Bearer ${STORAGE_KEY}`,
          'Content-Type': mimeType,
          'x-upsert': 'true'
        },
        body: buf
      }
    )
    if (uploadRes.ok) {
      // Le bucket est public : URL directe, pas besoin de signature.
      return `${process.env.SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`
    }
    const errBody = await uploadRes.text().catch(() => '')
    console.error('[devis] upload photo échoué, statut:', uploadRes.status, errBody)
  } catch (e) {
    console.error('[devis] upload photo erreur:', e.message)
  }
  return base64
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nom, prenom, email: emailRaw, service, prix, message, photos } = req.body
  const email = emailRaw ? emailRaw.toLowerCase().trim() : emailRaw
  const prixStr = prix ? prix.toString().replace('€', '').trim() : null
  const isQuote = prixStr && prixStr.toLowerCase() !== 'sur devis' && !isNaN(parseFloat(prixStr))

  console.log('[devis] body reçu:', JSON.stringify({ nom, email, service, prix, prixStr, isQuote }))

  // Vérifier doublon uniquement pour les nouvelles demandes
  if (!isQuote) {
    const dupRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=eq.${encodeURIComponent(email)}&statut=eq.devis&select=id`,
      { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` } }
    )
    const dupData = await dupRes.json()
    console.log('[devis] vérif doublon status=', dupRes.status, 'data=', JSON.stringify(dupData))
    if (Array.isArray(dupData) && dupData.length > 0) {
      console.log('[devis] doublon détecté, retour 409')
      return res.status(409).json({ error: 'exists' })
    }
  } else {
    console.log('[devis] envoi devis avec prix réel, doublon ignoré')
  }

  if (!isQuote) {
    // Upload des photos vers Supabase Storage avant insertion
    const uploadedPhotos = await Promise.all(
      (Array.isArray(photos) ? photos : []).map((p, i) => uploadPhotoToStorage(p, i))
    )

    // Nouvelle demande : INSERT (bloquant — sécurité)
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
        statut: 'devis',
        notes: JSON.stringify({ message: message || null, photos: uploadedPhotos })
      })
    })
    const sbData = await sbRes.json()
    console.log('[devis] Supabase INSERT status:', sbRes.status, 'response:', JSON.stringify(sbData))
    if (sbRes.status >= 400) {
      return res.status(500).json({ error: 'Supabase insert failed', detail: sbData })
    }
  } else {
    // Envoi du prix par l'admin : PATCH la ligne existante
    const patchRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reservations?cliente_email=eq.${encodeURIComponent(email)}&statut=eq.devis`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        },
        body: JSON.stringify({ prix: prixStr })
      }
    )
    console.log('[devis] Supabase PATCH prix status:', patchRes.status)
  }

  const prenom_ = prenom || nom || 'toi'

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
        <p style="margin-top:20px">Maintenant que tu as ton devis, tu peux réserver ton créneau directement ici 👉 <a href="https://honeylocks.fr">https://honeylocks.fr</a></p>
        <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#c9a84c">Honey Locks 🍯</h2>
        <p>Bonjour ${prenom_},</p>
        <p>Ta demande de devis a bien été envoyée ! Tu recevras ton devis très rapidement. Pense à vérifier tes spams 🍯</p>
        <p style="color:#999;font-size:12px">Honey Locks · Lyon · Disponible 7j/7</p>
      </div>`

  const transport = makeTransport()

  // Emails en parallèle (await — garantit l'envoi avant que Vercel ferme la Lambda)
  const emailPromises = [
    transport.sendMail({
      from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: isQuote ? '🍯 Ton devis Honey Locks' : '🍯 Demande reçue — Honey Locks',
      html: htmlBody
    }).then(info => console.log('[devis] mail cliente envoyé:', info.messageId))
      .catch(e => console.error('[devis] erreur mail cliente:', e.message))
  ]

  if (!isQuote) {
    emailPromises.push(
      transport.sendMail({
        from: `"Honey Locks 🍯" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: '🔔 Nouvelle demande de devis — ' + (nom || email),
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#222">
            <h2 style="color:#c9a84c">Nouvelle demande de devis 🍯</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Instagram</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${nom || '—'}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${email}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Prestation</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${service || '—'}</td></tr>
              ${message ? `<tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Message</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${message}</td></tr>` : ''}
            </table>
            <p style="margin-top:16px;font-size:13px;color:#666">Connecte-toi à l'admin sur <a href="https://honeylocks.fr">honeylocks.fr</a> pour envoyer le devis.</p>
          </div>
        `
      }).catch(e => console.error('[devis] erreur notif Maïna:', e.message))
    )
  }

  await Promise.all(emailPromises)

  res.status(200).json({ success: true })
}
