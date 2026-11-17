# Lokalni Supabase za razvoj i testiranje

Ovo podiže lokalnu kopiju Supabase servisa bez Docker-a: PostgreSQL 16, Supabase Auth (GoTrue),
PostgREST, Supabase Storage i mali gateway na `http://127.0.0.1:54321` (isti oblik URL-a kao pravi Supabase).
Koristi se samo za razvoj i automatske testove. Produkcija koristi Supabase projekat.

## Jednokratna priprema (Linux)

```bash
sudo mkdir -p /opt/sb && cd /opt/sb
curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar xJ
curl -sSL https://github.com/supabase/auth/releases/download/v2.164.0/auth-v2.164.0-x86.tar.gz | tar xz
git clone --depth 1 --branch v1.11.13 https://github.com/supabase/storage.git storage
(cd storage && npm ci --ignore-scripts && npm rebuild fs-xattr --nodedir=<putanja do node headera> && npm run build)
cp <repo>/scripts/local-supabase/* /opt/sb/
```

Zatim napravite `keys.env` sa tri vrednosti: `JWT_SECRET` (nasumičan string od bar 32 znaka) i
`ANON_KEY` / `SERVICE_KEY` (HS256 JWT potpisani tom tajnom, sa `role` = `anon` odnosno `service_role`).
Pokrenite `./up.sh`. `FRESH=1 ./up.sh` briše bazu i ponovo primenjuje sve migracije.

- Mejlovi (pozivnice, nova lozinka) se ne šalju napolje. Čuvaju se kao fajlovi u `/opt/sb/mails`.
- Trenera dodajete ovako: upišite email u `coach_allowlist`, pa `./mkuser.sh <email> <lozinka> "<Ime>"`.
- Posle nove migracije pokrenite `notify pgrst, 'reload schema';` da PostgREST vidi nove funkcije.

`.env.local` za aplikaciju:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY iz keys.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_KEY iz keys.env>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
