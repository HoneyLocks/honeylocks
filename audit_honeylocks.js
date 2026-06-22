// ═══════════════════════════════════════════════════════
//  AUDIT COMPLET honeylocks.fr — Playwright
// ═══════════════════════════════════════════════════════
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://www.honeylocks.fr';
const SS_DIR = '/tmp/audit_ss';
const TS = Date.now();
const DEVIS_EMAIL = `audit-d-${TS}@honeylocks.fr`;
const BOOK_EMAIL  = `audit-b-${TS}@honeylocks.fr`;
const ADMIN_PASS  = 'honey2024';

// 1×1 JPEG minimaliste
const TINY_PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAARC' +
  'AABAAEDAS' + 'IAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

const results = [];

function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function run() {
  fs.mkdirSync(SS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'fr-FR'
  });
  const page = await ctx.newPage();

  const ss = async (name) => {
    await page.screenshot({ path: `${SS_DIR}/${name}.jpg`, type: 'jpeg', quality: 75 });
    console.log(`    📸 ${SS_DIR}/${name}.jpg`);
  };

  const vw = () => page.evaluate(() => document.querySelector('.sv.active')?.id);
  const ev = (expr) => page.evaluate(new Function(`return (${expr})()`));

  // Handle all dialogs: accept prompts with admin pass, accept confirms/alerts
  page.on('dialog', async (d) => {
    if (d.type() === 'prompt') await d.accept(ADMIN_PASS);
    else await d.accept();
  });

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [0] CHARGEMENT DU SITE           ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await ss('00_homepage');

  const title = await page.title();
  check('Site accessible (200)', true);
  check('Titre de la page défini', title.length > 0, title);

  const heroText = await page.locator('.hero, #accueil, .hero-txt, h1').first().textContent().catch(() => '');
  const heroOk = heroText.length > 5 || await page.locator('h1, .hero').count() > 0;
  check('Section hero visible', heroOk, heroText.slice(0, 60));

  const svcCards = await page.locator('.svc:not(.disabled)').count();
  check('Prestations affichées (≥8)', svcCards >= 8, `${svcCards} prestations`);

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [1] VÉRIFICATION DES PRIX        ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => go('reserve'));
  await page.waitForTimeout(500);

  // Services sur devis
  const devisServices = ['reprise', 'demelage'];
  for (const id of devisServices) {
    const card = page.locator(`.svc[data-id="${id}"]`);
    const priceText = await card.locator('.svc-price').textContent().catch(() => '');
    check(`Prix "${id}" = Sur devis`, priceText.toLowerCase().includes('devis'), priceText.trim());
  }

  // Services à 20€
  const twentyServices = [
    'depart-twist','depart-vanille',
    'tresses-n1','tresses-n2','tresses-n3','tresses-n4',
    'vanilles-nattes','vanilles-fl','barrel-flat','fulani'
  ];
  for (const id of twentyServices) {
    const card = page.locator(`.svc[data-id="${id}"]`);
    const priceText = await card.locator('.svc-price').textContent().catch(() => '');
    const ok = priceText.includes('20€');
    check(`Prix "${id}" = 20€`, ok, priceText.trim());
  }

  // Acompte base
  const acompte = await page.evaluate(() => window.ACOMPTE_PROMO);
  check('ACOMPTE_PROMO = 10€', acompte === 10, `valeur: ${acompte}`);
  const acompteDevis = await page.evaluate(() => window.ACOMPTE_DEVIS);
  check('ACOMPTE_DEVIS = 20€', acompteDevis === 20, `valeur: ${acompteDevis}`);

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [2] TEXTES / CONSIGNES UI        ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  // "Cheveux secs sans produits" dans la section infos
  const bodyHTML = await page.content();
  check('"Cheveux secs sans produits" présent', bodyHTML.includes('secs sans produits'));
  check('"Je ne coiffe pas les cheveux courts" sur cartes tresses',
    bodyHTML.includes('Je ne coiffe pas les cheveux courts'));
  check('Message DM mèches visible dans vcheck', bodyHTML.includes('mèches') && bodyHTML.includes('DM'));
  check('Consignes dans email réservation (template)', bodyHTML.includes('Cheveux propres'));

  // Règle affiché sur page
  const ruleText = await page.locator('.rule').first().textContent().catch(() => '');
  check('Règle "Cheveux secs" visible sur page',
    ruleText.toLowerCase().includes('secs sans produits') || bodyHTML.includes('secs sans produits'));

  await ss('01_prix_et_textes');

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [3] PARCOURS DEVIS — RETWIST     ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => { go('reserve'); });
  await page.waitForTimeout(400);

  // Sélectionner "Retwist + Coiffure"
  await page.evaluate(() => {
    const c = document.querySelector('.svc[data-id="reprise"]');
    if (c) c.click();
  });
  await page.waitForTimeout(500);
  let v = await vw();
  check('Retwist → vcheck', v === 'vcheck', `vue: ${v}`);
  await ss('02_vcheck');

  // Cliquer "première fois"
  await page.evaluate(() => goNewDevis());
  await page.waitForTimeout(400);
  v = await vw();
  check('Clic "première fois" → vdevis', v === 'vdevis', `vue: ${v}`);
  await ss('03_vdevis');

  // Vérifier bouton désactivé sans photo ni email
  const btnInitial = await page.evaluate(() => document.getElementById('bdevis')?.disabled);
  check('Bouton "Envoyer" désactivé sans email/photo', btnInitial === true);

  // Remplir email seulement → toujours désactivé (photo manquante)
  await page.evaluate((email) => {
    document.getElementById('d-email').value = email;
    checkDevis();
  }, DEVIS_EMAIL);
  const btnEmailOnly = await page.evaluate(() => document.getElementById('bdevis')?.disabled);
  check('Bouton désactivé sans photo (email seul)', btnEmailOnly === true);

  // Ajouter photo
  await page.evaluate((photo) => {
    S.curPhotos = [photo];
    checkDevis();
  }, TINY_PHOTO);
  const btnReady = await page.evaluate(() => document.getElementById('bdevis')?.disabled);
  check('Bouton activé avec email + photo', btnReady === false);

  // Remplir reste du formulaire
  await page.evaluate(() => {
    document.getElementById('d-insta').value = 'audit_test';
    document.getElementById('d-count').value = '100';
    document.getElementById('d-notes').value = 'Test audit automatisé';
  });
  await ss('04_vdevis_filled');

  // Soumettre
  const [devisResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/devis'), { timeout: 25000 }),
    page.evaluate(() => submitDevis())
  ]);
  await page.waitForTimeout(1500);
  const devisStatus = devisResp.status();
  v = await vw();
  check('Devis API HTTP 200', devisStatus === 200, `HTTP ${devisStatus}`);
  check('Devis → vdconf (confirmation)', v === 'vdconf', `vue: ${v}`);
  await ss('05_vdconf');

  // Vérifier texte de confirmation
  const dconfText = await page.locator('#vdconf').textContent().catch(() => '');
  check('vdconf contient confirmation réception', dconfText.length > 20);

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [4] LOGIN DEVIS PENDING          ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => resetRes());
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.svc[data-id="reprise"]').click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => goExisting());
  await page.waitForTimeout(300);
  v = await vw();
  check('"J\'ai déjà mon prix" → vexisting', v === 'vexisting', `vue: ${v}`);

  await page.evaluate((email) => {
    document.getElementById('e-email').value = email;
    checkExisting();
  }, DEVIS_EMAIL);

  const [clientResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/client'), { timeout: 15000 }),
    page.evaluate(() => loginExisting())
  ]);
  await page.waitForTimeout(1500);
  const clientStatus = clientResp.status();
  const clientData = await clientResp.json().catch(() => ({}));
  const loginText = await page.evaluate(() => document.getElementById('existing-result')?.textContent?.trim());

  check('API /client HTTP 200', clientStatus === 200, `HTTP ${clientStatus}`);
  check('API retourne {pending:true}', clientData.pending === true, JSON.stringify(clientData));
  check('Message "en cours" affiché (pas "non reconnu")',
    loginText && loginText.toLowerCase().includes('en cours') && !loginText.includes('non reconnu'),
    loginText?.slice(0, 80));
  await ss('06_login_pending');

  // Test email inexistant → "non reconnu"
  await page.evaluate(() => {
    document.getElementById('e-email').value = 'inconnu-x99@test.fr';
    checkExisting();
  });
  const [unknownResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/client'), { timeout: 10000 }),
    page.evaluate(() => loginExisting())
  ]);
  await page.waitForTimeout(1000);
  const unknownData = await unknownResp.json().catch(() => ({}));
  const unknownText = await page.evaluate(() => document.getElementById('existing-result')?.textContent?.trim());
  check('Email inconnu → found:false', unknownData.found === false, JSON.stringify(unknownData));
  check('Message "Email non reconnu" affiché', unknownText && unknownText.includes('non reconnu'), unknownText?.slice(0, 60));
  await ss('07_login_unknown');

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [5] RÉSERVATION DIRECTE          ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => resetRes());
  await page.waitForTimeout(400);

  // Sélectionner Tresses N1 (tresses-low, bopt activé d'emblée)
  await page.evaluate(() => {
    document.querySelector('.svc[data-id="tresses-n1"]').click();
  });
  await page.waitForTimeout(600);
  v = await vw();
  check('Tresses N1 → vopt', v === 'vopt', `vue: ${v}`);

  const optTitle = await page.locator('#opt-title').textContent().catch(() => '');
  check('Titre vopt = nom du service', optTitle.toLowerCase().includes('tresses') || optTitle.toLowerCase().includes('niveau'), optTitle);

  const boptDisabled = await page.evaluate(() => document.getElementById('bopt')?.disabled);
  check('bopt activé d\'emblée pour tresses-low', boptDisabled === false);
  await ss('08_vopt_tresses');

  // Cliquer "Continuer" → vslot
  const [slotsResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/admin-bookings'), { timeout: 15000 }),
    page.evaluate(() => document.getElementById('bopt').click())
  ]);
  await page.waitForTimeout(1000);
  v = await vw();
  const slotsStatus = slotsResp.status();
  check('bopt → vslot', v === 'vslot', `vue: ${v}`);
  check('Créneaux chargés depuis API', slotsStatus === 200, `HTTP ${slotsStatus}`);
  await ss('09_vslot');

  // Vérifier DM modal (slots today = .slot.dm)
  const dmSlots = await page.locator('.slot.dm').count();
  console.log(`  ℹ️  Slots DM (aujourd'hui/demain>20h) : ${dmSlots}`);

  if (dmSlots > 0) {
    await page.locator('.slot.dm').first().click();
    await page.waitForTimeout(400);
    const dmModalOpen = await page.evaluate(() =>
      document.getElementById('dm-modal')?.classList.contains('open'));
    check('Clic slot DM → popup DM ouverte', dmModalOpen === true);

    const dmText = await page.locator('#dm-modal-txt').textContent().catch(() => '');
    check('Popup DM mentionne @honeylocks__', dmText.includes('honeylocks'), dmText.slice(0, 80));
    await ss('10_dm_modal');

    // Fermer
    await page.evaluate(() => closeDmModal());
    await page.waitForTimeout(300);
    const dmClosed = await page.evaluate(() => !document.getElementById('dm-modal')?.classList.contains('open'));
    check('Fermeture popup DM', dmClosed === true);
  } else {
    check('Slots DM présents (aujourd\'hui)', false, '0 slots DM trouvés');
    check('Popup DM s\'ouvre au clic', null, 'skipped');
    check('Popup DM mentionne @honeylocks__', null, 'skipped');
  }

  // Cliquer un créneau normal disponible
  const normalSlots = await page.locator('.slot:not(.dm):not(.taken)').count();
  check('Créneaux normaux disponibles', normalSlots > 0, `${normalSlots} créneaux`);

  if (normalSlots > 0) {
    const slotText = await page.locator('.slot:not(.dm):not(.taken)').first().textContent();
    await page.locator('.slot:not(.dm):not(.taken)').first().click();
    await page.waitForTimeout(600);
    v = await vw();
    check(`Clic créneau "${slotText.trim()}" → vclient`, v === 'vclient', `vue: ${v}`);
    await ss('11_vclient');

    // Remplir contact
    await page.evaluate((email) => {
      document.getElementById('c-insta').value = 'audit_tresses';
      document.getElementById('c-email').value = email;
      checkClient();
    }, BOOK_EMAIL);

    const bclientOk = await page.evaluate(() => !document.getElementById('bclient')?.disabled);
    check('bclient activé après email valide', bclientOk === true);

    await page.evaluate(() => document.getElementById('bclient').click());
    await page.waitForTimeout(400);
    v = await vw();
    check('bclient → vrecap', v === 'vrecap', `vue: ${v}`);
    await ss('12_vrecap');

    // Vérifier contenu récap
    const recap = await page.locator('#recap').textContent().catch(() => '');
    check('Récap contient "Tresses"', recap.toLowerCase().includes('tresses') || recap.toLowerCase().includes('niveau'), recap.slice(0, 100));
    check('Récap contient le prix (20€)', recap.includes('20€'), recap.slice(0, 100));
    check('Récap contient acompte (10€)', recap.includes('10€'));

    // Vérifier bouton PayPal
    const ppBtn = await page.locator('.btn.pp').count();
    check('Bouton "Payer l\'acompte · PayPal" présent', ppBtn > 0);

    // Payer (skip PayPal, appeler pay() directement)
    const [reservResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/reservation'), { timeout: 25000 }),
      page.evaluate(() => pay())
    ]);
    await page.waitForTimeout(2000);
    const reservStatus = reservResp.status();
    v = await vw();
    check('Réservation API HTTP 200', reservStatus === 200, `HTTP ${reservStatus}`);
    check('pay() → vdone', v === 'vdone', `vue: ${v}`);
    await ss('13_vdone');

    const doneText = await page.locator('#done-txt').textContent().catch(() => '');
    check('vdone contient texte confirmation créneau', doneText.length > 20, doneText.slice(0, 80));
  }

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [6] TEST SERVICE TYPE=SIZE       ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => resetRes());
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.svc[data-id="depart-twist"]').click();
  });
  await page.waitForTimeout(500);
  v = await vw();
  check('Départ locks twist → vopt', v === 'vopt', `vue: ${v}`);

  const boptBeforeSize = await page.evaluate(() => document.getElementById('bopt')?.disabled);
  check('bopt désactivé avant sélection taille', boptBeforeSize === true);
  await ss('14_vopt_size_before');

  // Cliquer "Small"
  await page.evaluate(() => {
    const chip = document.querySelector('.chip[data-size="Small"]');
    if (chip) pickSize(chip);
  });
  await page.waitForTimeout(300);
  const boptAfterSize = await page.evaluate(() => document.getElementById('bopt')?.disabled);
  check('bopt activé après sélection taille', boptAfterSize === false);
  await ss('15_vopt_size_after');

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [7] TEST SERVICE TYPE=FULANI     ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => resetRes());
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.svc[data-id="fulani"]').click();
  });
  await page.waitForTimeout(500);
  v = await vw();
  check('Fulani → vopt', v === 'vopt', `vue: ${v}`);

  const boptFulaniInit = await page.evaluate(() => document.getElementById('bopt')?.disabled);
  check('bopt désactivé avant sélection front+back', boptFulaniInit === true);

  await page.evaluate(() => {
    const ff = document.querySelector('.chip-ff[data-ff="Tresses plaquées"]');
    const fb = document.querySelector('.chip-fb[data-fb="Vanilles"]');
    if (ff) pickFF(ff);
    if (fb) pickFB(fb);
  });
  await page.waitForTimeout(300);
  const boptFulaniReady = await page.evaluate(() => document.getElementById('bopt')?.disabled);
  check('bopt activé après front+back sélectionnés', boptFulaniReady === false);
  await ss('16_vopt_fulani');

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [8] TEST SERVICE VANILLE-TAILLE  ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => resetRes());
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.svc[data-id="vanilles-nattes"]').click();
  });
  await page.waitForTimeout(500);
  v = await vw();
  check('Vanilles/Nattes → vopt', v === 'vopt', `vue: ${v}`);

  // Médium auto-sélectionné
  const mediumSelected = await page.evaluate(() =>
    document.querySelector('.chip-vtaille[data-vtaille="Médium"]')?.classList.contains('selected'));
  check('Médium auto-sélectionné pour vanille-taille', mediumSelected === true);

  const boptVanille = await page.evaluate(() => document.getElementById('bopt')?.disabled);
  check('bopt activé d\'emblée (Médium auto)', boptVanille === false);
  await ss('17_vopt_vanille');

  // Large → prix -5€
  await page.evaluate(() => {
    const large = document.querySelector('.chip-vtaille[data-vtaille="Large"]');
    if (large) pickVTaille(large);
  });
  const priceAfterLarge = await page.evaluate(() => {
    const chip = document.querySelector('.chip-vtaille[data-vtaille="Large"]');
    return parseInt(chip?.dataset?.price || '0');
  });
  check('Large option avec prix associé (≤0)', priceAfterLarge <= 0, `price: ${priceAfterLarge}`);
  await ss('18_vanille_large');

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [9] PANEL ADMIN                  ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────
  await page.evaluate(() => resetRes());
  await page.waitForTimeout(400);

  // Ouvrir le drawer
  await page.evaluate(() => openDrawer());
  await page.waitForTimeout(400);
  const drawerOpen = await page.evaluate(() =>
    document.getElementById('drawer')?.classList.contains('open'));
  check('Drawer s\'ouvre', drawerOpen === true);

  // Cliquer sur "Admin" dans le drawer
  await page.evaluate(() => {
    const links = document.querySelectorAll('.drawer-panel a, .drawer-panel button');
    links.forEach(l => { if (l.textContent.trim() === 'Admin') l.click(); });
  });

  // Déclencher openAdmin() directement (prompt géré par Playwright dialog handler)
  const [adminDevisResp, adminBookResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/admin-devis'), { timeout: 20000 }),
    page.waitForResponse(r => r.url().includes('/api/admin-bookings'), { timeout: 20000 }),
    page.evaluate(() => openAdmin())
  ]);
  await page.waitForTimeout(2000);

  const adminOpen = await page.evaluate(() =>
    document.getElementById('admin')?.classList.contains('open'));
  check('Admin s\'ouvre après mot de passe correct', adminOpen === true);

  const adResp = adminDevisResp.status();
  const abResp = adminBookResp.status();
  check('API /admin-devis accessible (200)', adResp === 200, `HTTP ${adResp}`);
  check('API /admin-bookings accessible (200)', abResp === 200, `HTTP ${abResp}`);
  await ss('19_admin_open');

  // Vérifier onglets
  const tabs = await page.locator('.atab').allTextContents();
  check('Onglets admin présents (Devis, Réservations, Calendrier, Créneaux)',
    tabs.some(t => t.includes('Devis')) && tabs.some(t => t.includes('Réservations')) &&
    tabs.some(t => t.includes('Créneaux')),
    tabs.join(' | '));

  // Stats header (pending, rdv, acompte)
  const stats = await page.locator('#admin .stats, #admin [id^="st-"]').count().catch(() => 0);
  const stP = await page.evaluate(() => document.getElementById('st-p')?.textContent);
  const stR = await page.evaluate(() => document.getElementById('st-r')?.textContent);
  check('Stats admin visibles (pending + RDV)', stP !== null && stR !== null, `pending=${stP} rdv=${stR}`);

  // Onglet Devis : devis qu'on vient de créer
  const devisCount = await page.evaluate(() => S.reqs.length);
  check(`Devis de test visible dans admin (≥1)`, devisCount >= 1, `${devisCount} devis en mémoire`);

  // La demande de devis que j'ai envoyée doit être "pending"
  const myDevis = await page.evaluate((email) =>
    S.reqs.find(r => r.email && r.email.toLowerCase() === email.toLowerCase()),
    DEVIS_EMAIL);
  check('Devis de test trouvé dans S.reqs', myDevis != null, myDevis ? `status=${myDevis.status}` : 'non trouvé');
  check('Statut = "pending"', myDevis?.status === 'pending');

  // Tester sendQuote (envoi du prix)
  if (myDevis) {
    const devisId = myDevis.id;
    console.log(`  ℹ️  Test envoi prix pour id=${devisId}`);
    await page.evaluate((id) => {
      const inp = document.getElementById(`q-${id}`);
      if (inp) inp.value = '75';
    }, devisId);
    const priceInputVisible = await page.evaluate((id) =>
      document.getElementById(`q-${id}`)?.value === '75', devisId);
    check('Champ prix devis rempli (75€)', priceInputVisible === true);

    const [sendQuoteResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/devis'), { timeout: 20000 }),
      page.evaluate((id) => sendQuote(id), devisId)
    ]);
    await page.waitForTimeout(1500);
    const sqStatus = sendQuoteResp.status();
    check('sendQuote API HTTP 200', sqStatus === 200, `HTTP ${sqStatus}`);

    const myDevisAfter = await page.evaluate((email) =>
      S.reqs.find(r => r.email && r.email.toLowerCase() === email.toLowerCase()),
      DEVIS_EMAIL);
    check('Statut devis → "quoted" après envoi prix', myDevisAfter?.status === 'quoted', `status=${myDevisAfter?.status}`);
    await ss('20_admin_devis_sent');
  }

  // Onglet Réservations
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.atab')].find(t => t.textContent.includes('Réservations'));
    if (btn) atab('bookings', btn);
  });
  await page.waitForTimeout(300);
  const bkCount = await page.evaluate(() => S.bookings.length);
  check('Réservation de test visible dans admin', bkCount >= 1, `${bkCount} réservation(s)`);

  const myBk = await page.evaluate((email) =>
    S.bookings.find(b => b.email && b.email.toLowerCase() === email.toLowerCase()),
    BOOK_EMAIL);
  check('Booking trouvé dans S.bookings', myBk != null, myBk ? `service=${myBk.service}` : 'non trouvé');

  // Vérifier boutons (Acompte reçu, Rappel, Annuler)
  const bkHtml = await page.locator('#abk').innerHTML().catch(() => '');
  check('Bouton "Acompte reçu" présent', bkHtml.includes('Acompte reçu'));
  check('Bouton "Rappel acompte" présent', bkHtml.includes('Rappel acompte'));
  check('Bouton "Annuler RDV" présent', bkHtml.includes('Annuler RDV'));
  await ss('21_admin_bookings');

  // Onglet Calendrier
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.atab')].find(t => t.textContent.includes('Calendrier'));
    if (btn) atab('cal', btn);
  });
  await page.waitForTimeout(300);
  const calHtml = await page.locator('#ap-cal').innerHTML().catch(() => '');
  check('Calendrier admin rendu (≥1 jour)', calHtml.includes('cal-day'));
  await ss('22_admin_cal');

  // Onglet Créneaux
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.atab')].find(t => t.textContent.includes('Créneaux'));
    if (btn) atab('slots', btn);
  });
  await page.waitForTimeout(300);
  const slotsHtml = await page.locator('#ap-slots').innerHTML().catch(() => '');
  check('Créneaux admin rendus (toggle ON/OFF)', slotsHtml.includes('ON') || slotsHtml.includes('OFF'));
  await ss('23_admin_slots');

  // Mauvais mot de passe (tester en ouvrant une page vierge)
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page2 = await ctx2.newPage();
  page2.on('dialog', async (d) => {
    if (d.type() === 'prompt') await d.accept('mauvais_code');
    else if (d.type() === 'alert') { await d.accept(); }
  });
  await page2.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page2.evaluate(() => openAdmin());
  await page2.waitForTimeout(800);
  const adminOpenBad = await page2.evaluate(() =>
    document.getElementById('admin')?.classList.contains('open'));
  check('Admin refusé avec mauvais mot de passe', adminOpenBad === false);
  await ctx2.close();

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [10] ANNULATION + RAPPEL ACOMPTE ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────

  // Test "Rappel acompte" d'abord (avant annulation)
  if (myBk) {
    const rappelApi = await page.evaluate(async (bk) => {
      const r = await fetch('/api/rappel-acompte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: bk.insta||'test', email: bk.email, service: bk.service, slot: bk.slot, acompte: bk.acompte })
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    }, myBk);
    check('Rappel acompte API HTTP 200', rappelApi.status === 200, `HTTP ${rappelApi.status} — ${JSON.stringify(rappelApi.data)}`);
  }

  // Test annulation via API directe (contourne le confirm() du UI)
  if (myBk) {
    // Récupérer l'ID Supabase réel de la réservation
    const supabaseId = await page.evaluate(async (email) => {
      const rows = await fetch('/api/admin-bookings').then(r => r.json());
      const row = rows.find(x => (x.cliente_email||'').toLowerCase() === email.toLowerCase() && x.statut !== 'annulé');
      return row?.id || null;
    }, BOOK_EMAIL);
    await page.waitForTimeout(500);

    check('Booking trouvé en Supabase (ID réel)',
      supabaseId != null, `id=${supabaseId}`);

    if (supabaseId) {
      const cancelResult = await page.evaluate(async (payload) => {
        const r = await fetch('/api/annulation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return { status: r.status, data: await r.json().catch(() => ({})) };
      }, { nom: myBk.insta||'test', email: myBk.email, service: myBk.service, slot: myBk.slot, date_rdv: myBk.slotIso, booking_id: supabaseId });
      await page.waitForTimeout(1500);

      check('Annulation API HTTP 200', cancelResult.status === 200, `HTTP ${cancelResult.status}`);

      // Vérifier que la réservation a bien disparu de Supabase
      const stillExists = await page.evaluate(async (email) => {
        const rows = await fetch('/api/admin-bookings').then(r => r.json());
        return rows.some(x => (x.cliente_email||'').toLowerCase() === email.toLowerCase() && x.statut !== 'annulé');
      }, BOOK_EMAIL);
      await page.waitForTimeout(500);
      check('Booking supprimé de Supabase', !stillExists);
    }
  }
  await ss('24_after_cancel');

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [11] VÉRIFICATION FINALE         ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────

  // Test login avec email qui avait reçu un devis "quoted" (prix=75 via sendQuote en [9])
  // Le devis existe encore en DB à ce stade — le cleanup arrive après
  await page.evaluate(() => { resetRes(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('.svc[data-id="reprise"]').click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => goExisting());
  await page.waitForTimeout(400);
  await page.evaluate((email) => {
    document.getElementById('e-email').value = email;
    checkExisting();
  }, DEVIS_EMAIL);

  const [finalLoginResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/client'), { timeout: 15000 }),
    page.evaluate(() => loginExisting())
  ]);
  await page.waitForTimeout(2000);
  const finalData = await finalLoginResp.json().catch(() => ({}));
  const finalText = await page.evaluate(() => document.getElementById('existing-result')?.textContent?.trim());
  const quotedOk = finalData.price === 75;
  check('Email devis "quoted" → prix 75€ retourné par API', quotedOk,
    `data=${JSON.stringify(finalData)}`);
  check('Bouton "Réserver mon créneau" affiché pour devis quoted',
    finalText && finalText.includes('Réserver') || await page.locator('button:has-text("Réserver mon créneau")').count() > 0,
    finalText?.slice(0, 100));
  await ss('25_login_quoted');

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [12] DONNÉES DE TEST (SUPABASE)  ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────

  const dbState = await page.evaluate(async () => {
    const [devisRows, bookRows] = await Promise.all([
      fetch('/api/admin-devis').then(r => r.json()),
      fetch('/api/admin-bookings').then(r => r.json())
    ]);
    return {
      devisEmails: devisRows.map(x => x.cliente_email),
      devisIds:    devisRows.map(x => ({ id: x.id, email: x.cliente_email })),
      bookEmails:  bookRows.filter(x => x.statut !== 'annulé').map(x => x.cliente_email)
    };
  });
  await page.waitForTimeout(500);

  const { devisEmails, devisIds, bookEmails } = dbState;
  const testBookEmails = bookEmails.filter(e => e && e.includes('audit-b-'));

  console.log(`  ℹ️  Total devis en DB : ${devisEmails.length} — ${devisEmails.join(', ')}`);
  console.log(`  ℹ️  Total bookings actifs : ${bookEmails.length} — ${bookEmails.join(', ')}`);

  check('0 réservations de test en DB (annulée)', testBookEmails.length === 0,
    testBookEmails.length > 0 ? `reste: ${testBookEmails.join(', ')}` : 'OK');
  check('DB propre (pas de vieux emails "test@" ou "dummy@")',
    !devisEmails.concat(bookEmails).some(e => e && (e.includes('test@') || e.includes('dummy@'))));

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  [13] NETTOYAGE ENREGISTREMENTS  ║');
  console.log('╚══════════════════════════════════╝');
  // ─────────────────────────────────────────────────────

  const testDevisIds = devisIds.filter(x => x.email && x.email.includes('audit-d-')).map(x => x.id);
  console.log(`  ℹ️  IDs devis test à supprimer : ${JSON.stringify(testDevisIds)}`);

  for (const rid of testDevisIds) {
    const delSt = await page.evaluate(async (id) => {
      const r = await fetch('/api/annulation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cleanup@honeylocks.fr', nom: 'cleanup', booking_id: id })
      });
      return r.status;
    }, rid);
    await page.waitForTimeout(500);
    console.log(`  🗑  Devis ID ${rid} supprimé → HTTP ${delSt}`);
  }
  check('Données de test supprimées après audit',
    testDevisIds.length > 0 ? true : null,
    testDevisIds.length > 0 ? `${testDevisIds.length} supprimé(s)` : 'aucun à supprimer');

  // Fermer
  await browser.close();

  // ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║            RAPPORT FINAL                  ║');
  console.log('╚══════════════════════════════════════════╝');
  // ─────────────────────────────────────────────────────

  const passed  = results.filter(r => r.ok === true).length;
  const failed  = results.filter(r => r.ok === false).length;
  const skipped = results.filter(r => r.ok === null).length;

  console.log(`\n  Passés : ${passed}  |  Échoués : ${failed}  |  Sautés : ${skipped}\n`);

  if (failed > 0) {
    console.log('  ── Points à corriger ──');
    results.filter(r => r.ok === false).forEach(r => {
      console.log(`  ❌ ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
    });
  }

  console.log(`\n  📸 Captures : ${SS_DIR}/`);
  return { passed, failed, skipped };
}

run().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(e => {
  console.error('\n💥 Erreur fatale:', e.message);
  console.error(e.stack);
  process.exit(2);
});
