# Napredak

Poslednja provera: 17.11.2026.

## Kako je provereno

Aplikacija je testirana na lokalnoj kopiji Supabase-a (PostgreSQL 16 + Supabase Auth + PostgREST + Supabase Storage),
sa pravim prijavama, pozivnicama, otpremanjem fajlova i produkcijskim buildom (`next build` + `next start`).

- `npm run typecheck` – bez grešaka
- `npm test` – 31 unit test (formatiranje, telefoni, periodi, 1RM i obim, tempo trčanja, GPX, analitika, makroi, logika upitnika)
- `npm run test:db` – migracije + testovi bezbednosti i funkcija: prošli
- `npm run build` – uspešan
- Automatski prolaz kroz sve stranice kao trener (desktop) i kao klijent (telefon): sve vraćaju 200, bez grešaka u konzoli;
  klijent koji otvori trenersku adresu biva vraćen na svoju početnu
- Offline: sa ugašenim serverom, ranije otvoren trening se učitava i može da se zabeleži; trening sačuvan bez interneta
  se sam šalje kad se veza vrati; ostale stranice prikazuju offline poruku

## Provereni tokovi

- [x] Trener dodaje klijenta → mejl sa pozivnicom → klijent postavlja lozinku → ulazi u aplikaciju
- [x] Validacija forme (telefon, visina, dupli mejl)
- [x] Mere i grafik, interna zapažanja (zakačena), izvoz JSON
- [x] Početni upitnik: saglasnosti, 6 koraka, PDF nalaz i fotografija, pregled pre slanja, slanje, prikaz odgovora
- [x] Nedeljni izveštaj na telefonu: popunjavanje, slanje, prikaz treneru sa poređenjem i trendovima, označavanje kao pregledano
- [x] Program snage: 3 nedelje, 2 treninga, kopiranje nedelje sa +2,5 kg, aktivacija
- [x] Beleženje treninga na telefonu, tajmer odmora, čuvanje bez interneta i kasnija sinhronizacija
- [x] Program trčanja sa intervalima i zonama, uvoz GPX fajla, analitika
- [x] Plan ishrane sa ciljevima, obrocima, zamenom, aktivacija, prikaz klijentu
- [x] Klijent ne vidi nacrte, tuđe podatke ni interna zapažanja (SQL testovi)

## Šta je potrebno od vas za puštanje u rad

Vidi `DEPLOYMENT.md`: Supabase projekat, GitHub repozitorijum, Vercel projekat, mejlovi trenera.
