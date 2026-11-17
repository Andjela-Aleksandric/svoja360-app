# Promenljive okruženja

| Naziv | Gde se koristi | Javna? | Odakle |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser i server | da | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser i server | da | Supabase → Project Settings → API Keys → `anon` (legacy) ili `publishable` ključ |
| `SUPABASE_SERVICE_ROLE_KEY` | samo server | **ne** | Supabase → Project Settings → API Keys → `service_role` (legacy) ili `secret` ključ |
| `NEXT_PUBLIC_SITE_URL` | server | da | Adresa aplikacije, npr. `https://svoja360.vercel.app` (bez `/` na kraju) |

Napomene:

- Anon/publishable ključ je javan po dizajnu. Zaštitu daju RLS pravila u bazi.
- Service role/secret ključ zaobilazi RLS. Unosi se samo u Vercel (Environment Variables) i u lokalni `.env.local`.
  Nikad u kod, GitHub, čet ili mejl.
- Bez `SUPABASE_SERVICE_ROLE_KEY` aplikacija radi, ali trener ne može da šalje pozivnice ni da trajno briše klijente.
  Aplikacija to jasno kaže umesto da tiho ne uradi ništa.
- `.env.local` je u `.gitignore`.
