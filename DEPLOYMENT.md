# Puštanje u rad

Ukupno oko 30 minuta. Sve je na besplatnim planovima. Ključeve unosite samo u Supabase i Vercel, nigde drugde.

## 1. Supabase projekat

1. Na [supabase.com](https://supabase.com) napravite nalog i **New project**.
   - Region: **Central EU (Frankfurt)** (podaci ostaju u EU).
   - Sačuvajte lozinku baze u menadžer lozinki.
2. **SQL Editor → New query**. Otvorite fajlove iz `supabase/migrations/` redom i svaki pokrenite (Run):
   1. `20261117000001_schema.sql`
   2. `20261117000002_security.sql`
   3. `20261117000003_reference_data.sql`
   4. `20261117000004_app_functions.sql`
   5. `20261117000005_strength.sql`
   6. `20261117000006_running_nutrition.sql`
3. U istom SQL editoru upišite mejlove trenera (pre nego što se prvi put prijave):

   ```sql
   insert into public.coach_allowlist (email) values ('mejl.andjele@primer.com'), ('mejl.natalije@primer.com');
   ```

   Svaki nalog čiji je mejl na ovoj listi dobija ulogu trenera. Svi ostali su klijenti.

## 2. Podešavanja prijave (Authentication)

1. **Authentication → Sign In / Providers → Email**: uključeno. **Allow new users to sign up: isključeno.**
   Klijenti ulaze samo preko pozivnice trenera, treneri preko pozivnice iz Supabase-a (korak 4).
2. **Authentication → URL Configuration**:
   - Site URL: adresa aplikacije, npr. `https://svoja360.vercel.app`
   - Redirect URLs: dodajte `https://svoja360.vercel.app/**` (i `http://localhost:3000/**` za razvoj)
3. **Šabloni mejlova na srpskom (opciono).** Aplikacija radi i sa podrazumevanim engleskim šablonima Supabase-a.
   Supabase dozvoljava izmenu šablona tek kad se poveže sopstveni SMTP (korak 4). Posle toga, u
   **Authentication → Emails → Templates** promenite dva šablona:

   **Invite user** – naslov: `Pozivnica za SVOJA 360`

   ```html
   <h2>Dobro došli u SVOJA 360</h2>
   <p>Vaši treneri su vam napravili nalog. Kliknite na link i izaberite lozinku:</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/nova-lozinka">Postavi lozinku</a></p>
   <p>Link važi 24 sata.</p>
   ```

   **Reset password** – naslov: `Nova lozinka za SVOJA 360`

   ```html
   <h2>Nova lozinka</h2>
   <p>Kliknite na link da izaberete novu lozinku:</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nova-lozinka">Izaberi novu lozinku</a></p>
   <p>Ako niste tražili novu lozinku, slobodno ignorišite ovaj mejl.</p>
   ```

4. **Slanje mejlova.** Ugrađeni Supabase mejl servis šalje samo nekoliko mejlova na sat i služi za probu.
   Za stvaran rad povežite besplatan SMTP (npr. Brevo ili Resend imaju besplatne planove) u
   **Authentication → Emails → SMTP Settings**. Ovo nije obavezno za prve klijente, ali preporučujem pre većeg broja pozivnica.

## 3. GitHub i Vercel

1. Kod je u privatnom GitHub repozitorijumu.
2. Na [vercel.com](https://vercel.com) (prijava preko GitHub-a) → **Add New → Project** → izaberite repozitorijum.
3. Framework se prepoznaje sam (Next.js). Pre prvog deploy-a otvorite **Environment Variables** i dodajte
   četiri promenljive iz `ENVIRONMENT.md` (vrednosti iz Supabase → Project Settings → API / API Keys):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (adresa koju dobijete od Vercel-a, npr. `https://svoja360.vercel.app`)
4. **Deploy.** Ako se adresa promeni (npr. sopstveni domen), ažurirajte `NEXT_PUBLIC_SITE_URL` u Vercel-u i
   Site URL / Redirect URLs u Supabase-u, pa pokrenite **Redeploy**.

## 4. Prvi treneri

1. Supabase → **Authentication → Users → Add user → Send invitation**, za svaki trenerski mejl iz koraka 1.3.
2. Trener otvara mejl, postavlja lozinku i ulazi u aplikaciju kao trener.
3. U aplikaciji: **Podešavanja** → upišite ime i broj telefona (klijenti ga vide kao WhatsApp kontakt)
   i proverite rok za nedeljni izveštaj.

## 5. Prvi klijent

**Klijenti → Dodaj klijenta** → ostavite uključeno „Pošalji pozivnicu na mejl”. Klijent dobija mejl,
postavlja lozinku i vidi početni upitnik kao prvi korak.

## Instalacija na telefon

- iPhone: Safari → Deli → „Dodaj na početni ekran”.
- Android: Chrome → meni → „Instaliraj aplikaciju”.

## Kasnije izmene baze

Nove migracije se dodaju kao novi fajlovi u `supabase/migrations/` i pokreću u SQL editoru istim redom.
Postojeće migracije se ne menjaju posle puštanja u rad.

## Rezervne kopije

Na besplatnom Supabase planu ne računajte na rezervne kopije koje možete sami da vratite. Zato:
- jednom mesečno napravite kopiju baze (Supabase → Database → Backups ili `pg_dump` sa connection stringom iz Project Settings),
- po potrebi **Izvezi podatke (JSON)** na profilu klijenta daje kompletnu kopiju njegovih podataka.

Napomena: besplatan Supabase projekat se pauzira posle 7 dana bez ikakve aktivnosti. Dok klijenti koriste
aplikaciju to se ne dešava, a pauziran projekat se vraća jednim klikom.
