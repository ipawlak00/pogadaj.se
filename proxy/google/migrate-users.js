// =============================================================
//  Jednorazowa migracja kont w Firestore
// -------------------------------------------------------------
//  Co robi:
//   1) Przenosi każde konto z klucza-hasha na klucz = adres email
//      (żeby na liście w konsoli Firestore od razu było widać email).
//   2) Nadaje kolejne numery kont: 000001, 000002, …
//      — ipawlak000@gmail.com dostaje 000001, reszta wg daty założenia.
//   3) Ustawia licznik meta/counters.userSeq, żeby nowe rejestracje
//      dostawały kolejne numery.
//
//  Jak uruchomić (Cloud Shell, w katalogu proxy/google):
//     node migrate-users.js
//
//  Uwaga: używa Twojego tokena (gcloud auth print-access-token) — musisz
//  być zalogowana w gcloud jako właścicielka projektu. Bezpieczne do
//  wielokrotnego uruchomienia (idempotentne).
// =============================================================

const { execSync } = require('child_process');

const OWNER_EMAIL = 'ipawlak000@gmail.com';   // to konto dostaje numer 000001

const token = execSync('gcloud auth print-access-token').toString().trim();
const project = (process.env.PROJECT
  || execSync('gcloud config get-value project 2>/dev/null').toString().trim());

if (!token || !project) {
  console.error('Brak tokena lub projektu. Zaloguj się: gcloud auth login');
  process.exit(1);
}

const BASE = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

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

async function main() {
  console.log(`Projekt: ${project}`);
  const raw = await listAllUsers();
  console.log(`Znaleziono dokumentów w users: ${raw.length}`);

  // Zbierz konta z ich polami; email bierzemy z POLA email (pewne źródło).
  const accounts = raw.map((doc) => {
    const f = doc.fields || {};
    const oldId = decodeURIComponent(doc.name.split('/').pop());
    const email = (f.email?.stringValue || oldId).trim().toLowerCase();
    const createdAt = f.createdAt?.stringValue || '';
    return { email, createdAt, fields: f, oldName: doc.name, oldId };
  }).filter((a) => a.email && a.email.includes('@'));

  // Deduplikacja po emailu (gdyby istniał i hash, i email jako klucz).
  const byEmail = new Map();
  for (const a of accounts) {
    const prev = byEmail.get(a.email);
    // preferuj rekord z większą liczbą danych (dłuższy state) / nowszą datą
    if (!prev || (a.fields.state?.stringValue || '').length > (prev.fields.state?.stringValue || '').length) {
      byEmail.set(a.email, a);
    }
  }
  const unique = [...byEmail.values()];

  // Kolejność numerów: właścicielka pierwsza, potem wg daty założenia rosnąco.
  unique.sort((a, b) => {
    if (a.email === OWNER_EMAIL) return -1;
    if (b.email === OWNER_EMAIL) return 1;
    return (a.createdAt || '9999').localeCompare(b.createdAt || '9999');
  });

  console.log('\nPlan numeracji:');
  unique.forEach((a, i) => console.log(`  ${String(i + 1).padStart(6, '0')}  ${a.email}`));

  // Zapis nowych dokumentów (klucz = email) z numerem; usuń stare hashe.
  for (let i = 0; i < unique.length; i++) {
    const a = unique[i];
    const number = String(i + 1).padStart(6, '0');
    const fields = { ...a.fields, number: { stringValue: number } };
    if (!fields.createdAt) fields.createdAt = { stringValue: a.createdAt || new Date().toISOString() };

    const newUrl = `${BASE}/users/${encodeURIComponent(a.email)}`;
    const w = await fetch(newUrl, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
    if (!w.ok) { console.error(`  BŁĄD zapisu ${a.email}: ${w.status} ${(await w.text()).slice(0, 200)}`); continue; }
    console.log(`  ✓ ${number}  ${a.email}`);

    // Usuń stary dokument, jeśli miał inny klucz niż email (czyli był hashem).
    if (a.oldId !== a.email) {
      const del = await fetch(`https://firestore.googleapis.com/v1/${a.oldName}`, { method: 'DELETE', headers: H });
      if (!del.ok && del.status !== 404) console.error(`    (nie udało się usunąć starego ${a.oldId}: ${del.status})`);
    }
  }

  // Ustaw licznik na liczbę kont — kolejna rejestracja dostanie następny numer.
  const counterUrl = `${BASE}/meta/counters`;
  const c = await fetch(counterUrl, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ fields: { userSeq: { integerValue: String(unique.length) } } }),
  });
  if (!c.ok) console.error(`Licznik: ${c.status} ${(await c.text()).slice(0, 200)}`);
  else console.log(`\nLicznik userSeq = ${unique.length}. Następne konto: ${String(unique.length + 1).padStart(6, '0')}.`);

  console.log('\nGotowe. Odśwież konsolę Firestore — dokumenty mają teraz email jako nazwę i pole number.');
}

main().catch((e) => { console.error('Migracja padła:', e.message); process.exit(1); });
