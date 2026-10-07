// Contrôle d'accès admin (fichier préfixé "_" : non exposé comme fonction par Vercel)
const crypto = require('crypto')

function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD
  const given = req.headers && req.headers['x-admin-key']
  if (!expected || typeof given !== 'string' || !given) return false
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

// Renvoie true si autorisé, sinon répond 401 et renvoie false
function requireAdmin(req, res) {
  if (isAdmin(req)) return true
  res.status(401).json({ error: 'Accès admin refusé' })
  return false
}

module.exports = { isAdmin, requireAdmin }
