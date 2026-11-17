# SVOJA 360 – platforma za hibridni coaching

Aplikacija za dva trenera (Anđela i Natalija) i njihove klijente: trening snage, trčanje, ishrana,
početni upitnik, trodnevni dnevnik ishrane, nedeljni izveštaji i praćenje napretka.
Interfejs je na srpskom (latinica). Kod, baza i API su na engleskom.

Komunikacija sa klijentima ide isključivo preko WhatsApp-a (dugme u aplikaciji otvara `wa.me` link).
Aplikacija nema chat, pretplate ni plaćanje.

## Tehnologije

| Deo | Izbor |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI, Motion, Recharts |
| Backend | Supabase (PostgreSQL, Auth, Storage, Row Level Security) |
| Hosting | Vercel (besplatan plan) |
| PWA | manifest, service worker, offline stranica, beleženje treninga bez interneta |
| Testovi | Vitest (logika), SQL testovi bezbednosti nad pravim migracijama |

Sve korišćeno je besplatno. Nema plaćenih API-ja.

## Struktura

```
src/app/(auth)        prijava, zaboravljena lozinka, nova lozinka
src/app/auth          potvrda linka iz mejla, odjava
src/app/trener        sve stranice trenera
src/app/klijent       sve stranice klijenta
src/app/actions       server akcije koje koriste i trener i klijent
src/components        UI komponente po modulima (ui, strength, running, nutrition, questionnaire...)
src/lib               podaci (data/), logika (strength/, running/, nutrition/, questionnaire/), prevodi (i18n/sr.ts)
supabase/migrations   šema, bezbednost (RLS), referentni podaci, funkcije
supabase/tests        SQL testovi bezbednosti i funkcija
scripts               test baze, lokalni Supabase za razvoj
public                ikone i service worker
```

Svi tekstovi interfejsa su u `src/lib/i18n/sr.ts`.

## Pokretanje lokalno

```bash
npm install
cp .env.example .env.local   # popunite vrednostima (vidi ENVIRONMENT.md)
npm run dev
```

Provere:

```bash
npm run typecheck   # TypeScript
npm test            # unit testovi (Vitest)
npm run test:db     # migracije + testovi bezbednosti na privremenoj PostgreSQL bazi
npm run build       # produkcijski build
```

`npm run test:db` traži lokalno instaliran PostgreSQL 16 (`/usr/lib/postgresql/16/bin`).
Za rad sa kompletnim lokalnim Supabase-om (prijava, mejlovi, fajlovi) vidi `scripts/local-supabase/README.md`.

## Puštanje u rad

Korak po korak uputstvo je u **DEPLOYMENT.md** (Supabase projekat, migracije, mejl šabloni, Vercel, prvi treneri).

## Dokumentacija

- `DEVELOPMENT_PLAN.md` – faze razvoja i obim
- `PROGRESS.md` – šta je urađeno i provereno
- `DATABASE_SCHEMA.md` – tabele, bezbednost i funkcije
- `ENVIRONMENT.md` – promenljive okruženja
- `DEPLOYMENT.md` – puštanje u rad

## Bezbednost ukratko

- Svaka tabela ima Row Level Security. Klijent vidi samo svoje podatke, i to samo aktivne planove.
- Promena URL-a ili API poziva ne otkriva tuđe podatke: provera je u bazi, ne u aplikaciji.
- Osetljivi odgovori (zdravlje, terapija, nalazi) i fotografije traže saglasnost klijenta, takođe proverenu u bazi.
- Fajlovi su u privatnom bucket-u i otvaraju se samo linkom koji važi 10 minuta.
- Service role ključ se koristi samo na serveru, samo za pozivnice i trajno brisanje klijenta.
- Izvoz podataka (JSON) i trajno brisanje klijenta za zahteve po GDPR-u. Izvoz se upisuje u audit log.
