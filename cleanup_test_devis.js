const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ headless: true });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('https://www.honeylocks.fr', { waitUntil: 'networkidle', timeout: 30000 });

  const rows = await p.evaluate(async () => {
    const [d, b] = await Promise.all([
      fetch('/api/admin-devis').then(r => r.json()),
      fetch('/api/admin-bookings').then(r => r.json())
    ]);
    return [...d, ...b];
  });

  const TEST_PATTERNS = [/test/i, /example\.com/i, /marc971/i, /test_ci/i, /raphmissblack/i];
  const toDelete = rows.filter(r => {
    const email = (r.cliente_email || '').toLowerCase();
    const nom   = (r.cliente_nom  || '').toLowerCase();
    return TEST_PATTERNS.some(re => re.test(email) || re.test(nom));
  });

  if (!toDelete.length) { console.log('Aucun devis/réservation de test trouvé.'); await br.close(); process.exit(0); }

  console.log(`${toDelete.length} entrée(s) à supprimer :`);
  toDelete.forEach(r => console.log(' -', r.cliente_email, '/', r.cliente_nom, `(id ${r.id})`));

  for (const row of toDelete) {
    const st = await p.evaluate(async (id) => {
      const r = await fetch('/api/annulation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@x.fr', nom: 'x', booking_id: id })
      });
      return r.status;
    }, row.id);
    console.log(`  id=${row.id} → HTTP ${st}`);
    await p.waitForTimeout(300);
  }

  const check = await p.evaluate(async () => {
    const [d, b] = await Promise.all([
      fetch('/api/admin-devis').then(r => r.json()),
      fetch('/api/admin-bookings').then(r => r.json())
    ]);
    return { devis: d.length, bookings: b.length };
  });
  console.log('\nDevis restants :', check.devis, '| Réservations :', check.bookings);
  await br.close();
})().catch(e => { console.error(e.message); process.exit(1); });
