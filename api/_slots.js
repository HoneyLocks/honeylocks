// Créneau suivant d'une journée (fichier préfixé "_" : non exposé comme fonction par Vercel)
const DEFAULT_TIMES = ['10:30', '14:30', '18:30']

const toMin = t => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '')
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
}

// Prestations longues qui bloquent aussi le créneau suivant : départs de locks et vanilles
const blocksNext = service => /^(Départ de locks|Vanilles)/.test((service || '').trim())

// Créneau qui suit `heure` dans la liste `times`, ou null si c'est le dernier de la journée
function nextFromTimes(times, heure) {
  const cur = toMin(heure)
  if (cur === null) return null
  const after = (times && times.length ? times : DEFAULT_TIMES)
    .filter(t => toMin(t) !== null && toMin(t) > cur).sort((a, b) => toMin(a) - toMin(b))
  return after[0] || null
}

// Heure du créneau qui suit `heure` le jour `date` (selon slots_config), ou null si c'est le dernier
async function nextSlot(date, heure) {
  if (!date || !heure) return null
  let times = DEFAULT_TIMES
  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/slots_config?date=eq.${encodeURIComponent(date)}&select=slots`,
      { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` } }
    )
    const rows = await r.json()
    const slots = Array.isArray(rows) && rows[0] && Array.isArray(rows[0].slots) ? rows[0].slots : null
    if (slots && slots.length) times = slots.map(s => s.time)
  } catch (e) { console.error('[_slots] lecture slots_config:', e.message) }
  return nextFromTimes(times, heure)
}

module.exports = { nextSlot, nextFromTimes, blocksNext, toMin, DEFAULT_TIMES }
