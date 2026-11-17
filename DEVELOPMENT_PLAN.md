# Plan razvoja

| Faza | Sadržaj | Status |
|---|---|---|
| 1. Osnova | Next.js, dizajn sistem, prijava i pozivnice, uloge, RLS, PWA (manifest, ikone, service worker, offline stranica), navigacija | gotovo |
| 2. Klijenti | kontrolna tabla trenera, lista (pretraga, filteri, sortiranje), profil, WhatsApp, zapažanja, mere, izvoz, arhiviranje, brisanje | gotovo |
| 3. Upitnik | početni upitnik u 6 koraka, saglasnosti, otpremanje fajlova, verzije, trodnevni dnevnik ishrane, pregled trenera | gotovo |
| 4. Nedeljni izveštaji | izveštaj za prethodnu nedelju, rok koji trener podešava, jedan po periodu, pregled, poređenje, trendovi | gotovo |
| 5. Snaga | biblioteka vežbi, program po nedeljama i danima, serije/RIR/RPE/tempo/odmor, superserije, drop serije, lakša nedelja, progresija, šabloni, beleženje treninga sa tajmerom i prethodnim rezultatom, offline, analitika (obim, 1RM, rekordi) | gotovo |
| 6. Trčanje | program sa segmentima, zone, 10 tipova treninga, nedeljna kilometraža, ručni unos, GPX/FIT uvoz, analitika | gotovo |
| 7. Ishrana | biblioteka namirnica, plan po danima i obrocima, automatski makroi, zamene, šabloni obroka, prikaz klijentu | gotovo |
| 8. Napredak | zbirni pregled napretka, fotografije sa poređenjem, početna strana klijenta | gotovo |
| 9. Završnica | testovi, provera svih stranica, offline provera, dokumentacija, uputstvo za puštanje u rad | gotovo |
| 10. Budućnost | vidi dole | nije počelo |

## Faza 10 – moguća proširenja

- Automatski uvoz aktivnosti iz Strave / Garmin Connect (zahteva njihove API dozvole i OAuth).
- Podsetnici (push notifikacije ili mejl) za nedeljni izveštaj i trening.
- Generisani TypeScript tipovi iz baze (`supabase gen types`) umesto ručnih tipova u `src/lib/*/types.ts`.
- Pretraga namirnica preko otvorene baze (npr. Open Food Facts) uz ručnu proveru vrednosti.
- Engleska verzija interfejsa (svi tekstovi su već na jednom mestu u `src/lib/i18n/sr.ts`).

Pravila koja važe za sve faze: bez chat-a, bez plaćanja, bez plaćenih servisa bez odobrenja,
nijedan osetljiv podatak javno dostupan, bezbednost se proverava u bazi.
