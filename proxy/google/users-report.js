// =============================================================
//  Raport użytkowników — czytelny podgląd, kto na jakim etapie
//  i ile przegadał. Uruchom w Cloud Shell:  node users-report.js
//  (używa Twojego tokena: gcloud auth print-access-token)
// =============================================================

const { execSync } = require('child_process');

const token = execSync('gcloud auth print-access-token').toString().trim();
const project = (process.env.PROJECT
  || execSync('gcloud config get-value project 2>/dev/null').toString().trim());

const BASE = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const H = { Authorization: 'Bearer ' + token };

async function listAllUsers() {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${BASE}/users?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const r = await fetch(url, { headers: H });
    if (!r.ok) throw new Error('LIST ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const d = await r.json();
    (d.documents || []).forEach((doc) => docs.push(doc));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return docs;
}

const pad = (s, n) => String(s == null ? '' : s).padEnd(n).slice(0, n);
const mins = (sec) => Math.round((sec || 0) / 60);

async function main() {
  const raw = await listAllUsers();
  const rows = raw.map((doc) => {
    const f = doc.fields || {};
    const number = f.number?.stringValue || '------';
    const email = f.email?.stringValue || '(brak)';
    const name = f.name?.stringValue || '';
    const created = (f.createdAt?.stringValue || '').slice(0, 10);
    let st = {};
    try { st = JSON.parse(f.state?.stringValue || '{}'); } catch { st = {}; }
    const ob = st.onboarding || {}, ph = st.phonetic || {}, pr = st.progress || {};
    const hist = pr.history || [];
    const lessons = hist.filter((h) => h.kind === 'full').length;
    const totalSec = hist.reduce((a, h) => a + (h.seconds || 0), 0);
    // etap w lejku
    let stage = 'rejestracja';
    if (ob.completed) stage = 'po onboardingu';
    if (ph.completed) stage = ph.skipped ? 'pominął test' : 'po teście wymowy';
    if (lessons > 0) stage = 'gada';
    return {
      number, email, name,
      level: ob.level || '-',
      stage,
      lessons,
      totalMin: mins(totalSec),
      monthMin: mins(pr.fullSecondsUsed),
      created,
    };
  }).sort((a, b) => a.number.localeCompare(b.number));

  console.log(`\nUżytkowników: ${rows.length}   (projekt: ${project})\n`);
  console.log(pad('NR', 8) + pad('EMAIL', 30) + pad('IMIĘ', 14) + pad('POZIOM', 8)
    + pad('ETAP', 18) + pad('LEKCJE', 8) + pad('ŁĄCZNIE min', 12) + pad('W MIES.', 9) + 'ZAŁOŻ.');
  console.log('-'.repeat(115));
  rows.forEach((r) => {
    console.log(pad(r.number, 8) + pad(r.email, 30) + pad(r.name, 14) + pad(r.level, 8)
      + pad(r.stage, 18) + pad(r.lessons, 8) + pad(r.totalMin, 12) + pad(r.monthMin, 9) + r.created);
  });

  const talking = rows.filter((r) => r.totalMin > 0);
  const totalMin = rows.reduce((a, r) => a + r.totalMin, 0);
  console.log('\nPodsumowanie:');
  console.log(`  Realnie gadających (czas > 0): ${talking.length} / ${rows.length}`);
  console.log(`  Łączny przegadany czas wszystkich: ${totalMin} min (~${Math.round(totalMin / 60)} h)`);
  console.log('');
}

main().catch((e) => { console.error('Raport padł:', e.message); process.exit(1); });
