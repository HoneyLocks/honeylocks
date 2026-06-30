const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ headless: true });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('https://www.honeylocks.fr', { waitUntil: 'networkidle', timeout: 30000 });

  const all = await p.evaluate(async () => {
    const [d, b] = await Promise.all([
      fetch('/api/admin-devis').then(r => r.json()),
      fetch('/api/admin-bookings').then(r => r.json())
    ]);
    return { devis: d, bookings: b };
  });

  console.log('Devis        :', all.devis.length);
  console.log('Réservations :', all.bookings.length);

  if (all.devis.length === 0 && all.bookings.length === 0) {
    console.log('\nDéjà vide.');
    await br.close(); process.exit(0);
  }

  for (const d of [...all.devis, ...all.bookings]) {
    const st = await p.evaluate(async (id) => {
      const r = await fetch('/api/annulation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@x.fr', nom: 'x', booking_id: id })
      });
      return r.status;
    }, d.id);
    console.log(' ', d.cliente_email, '→', st);
    await p.waitForTimeout(250);
  }

  const check = await p.evaluate(async () => {
    const [d, b] = await Promise.all([
      fetch('/api/admin-devis').then(r => r.json()),
      fetch('/api/admin-bookings').then(r => r.json())
    ]);
    return { devis: d.length, bookings: b.length };
  });

  console.log('\nDevis restants       :', check.devis);
  console.log('Réservations restantes:', check.bookings);
  await br.close();
  console.log(check.devis === 0 && check.bookings === 0 ? '\nVide ✓' : '\nATTENTION: entrées restantes');
  process.exit(check.devis === 0 && check.bookings === 0 ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
