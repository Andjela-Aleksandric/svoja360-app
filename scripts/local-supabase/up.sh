#!/usr/bin/env bash
# Local Supabase-compatible stack for testing (Postgres 16 + Auth + PostgREST + Storage + gateway).
set -euo pipefail
cd /opt/sb
source keys.env
APP=${APP:-$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)}
PGBIN=/usr/lib/postgresql/16/bin
PG="psql -h /tmp -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X"
FRESH=${FRESH:-0}
pkill -f "/opt/sb/auth serve" 2>/dev/null || true; pkill -f "/opt/sb/postgrest" 2>/dev/null || true
pkill -f "dist/start/server.js" 2>/dev/null || true; pkill -f "node gateway.js" 2>/dev/null || true; pkill -f "/opt/sb/mail.js" 2>/dev/null || true
if [ "$FRESH" = "1" ] && [ -d pgdata ]; then runuser -u postgres -- $PGBIN/pg_ctl -D pgdata -m immediate stop >/dev/null 2>&1 || true; rm -rf pgdata storage-data; fi
mkdir -p logs storage-data
if [ ! -d pgdata ]; then
  mkdir pgdata && chown postgres pgdata
  runuser -u postgres -- $PGBIN/initdb -D pgdata -U postgres -A trust >/dev/null
  NEW=1
else NEW=0; fi
runuser -u postgres -- $PGBIN/pg_ctl -D pgdata status >/dev/null 2>&1 || runuser -u postgres -- $PGBIN/pg_ctl -D pgdata -o "-p 54322 -k /tmp -c listen_addresses=127.0.0.1" -l /opt/sb/pgdata/pg.log -w start >/dev/null
DBURL_AUTH="postgres://supabase_auth_admin:postgres@127.0.0.1:54322/postgres?sslmode=disable&search_path=auth"
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="$DBURL_AUTH" GOTRUE_DB_DATABASE_URL="$DBURL_AUTH" GOTRUE_DB_NAMESPACE=auth \
  API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_SITE_URL=http://localhost:3000 \
  GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
  GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_DISABLE_SIGNUP=true \
  GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 \
  GOTRUE_SMTP_ADMIN_EMAIL=noreply@svoja360.local GOTRUE_SMTP_USER=x GOTRUE_SMTP_PASS=x GOTRUE_SMTP_SENDER_NAME=SVOJA360 \
  GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
  GOTRUE_MAILER_TEMPLATES_INVITE=http://127.0.0.1:2501/invite.html GOTRUE_MAILER_TEMPLATES_RECOVERY=http://127.0.0.1:2501/recovery.html \
  GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true GOTRUE_LOG_LEVEL=warn
node mail.js > logs/mail.log 2>&1 &
if [ "$NEW" = "1" ]; then
  $PG -f bootstrap.sql
  ./auth migrate > logs/auth-migrate.log 2>&1
fi
setsid nohup ./auth serve > logs/auth.log 2>&1 < /dev/null &
export SERVER_PORT=5000 SERVER_HOST=127.0.0.1 AUTH_JWT_SECRET="$JWT_SECRET" AUTH_JWT_ALGORITHM=HS256 ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_KEY" \
  DATABASE_URL="postgres://supabase_storage_admin:postgres@127.0.0.1:54322/postgres" DB_INSTALL_ROLES=false DB_ANON_ROLE=anon \
  DB_SERVICE_ROLE=service_role DB_AUTHENTICATED_ROLE=authenticated DB_SUPER_USER=supabase_storage_admin STORAGE_BACKEND=file \
  STORAGE_FILE_BACKEND_PATH=/opt/sb/storage-data FILE_STORAGE_BACKEND_PATH=/opt/sb/storage-data TENANT_ID=stub REGION=local GLOBAL_S3_BUCKET=stub \
  UPLOAD_FILE_SIZE_LIMIT=52428800 UPLOAD_FILE_SIZE_LIMIT_STANDARD=52428800 PG_QUEUE_ENABLE=false IMAGE_TRANSFORMATION_ENABLED=false \
  RATE_LIMITER_ENABLED=false LOG_LEVEL=warn SERVER_ADMIN_API_KEYS=x AUTH_ENCRYPTION_KEY=x NODE_ENV=production
(cd storage && nohup node dist/start/server.js > ../logs/storage.log 2>&1 &)
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:5000/status && break; sleep 0.5; done
if [ "$NEW" = "1" ]; then
  for f in $APP/supabase/migrations/*.sql; do echo "migrate $(basename $f)"; $PG -f "$f"; done
  $PG -f bootstrap-post.sql
  if [ -f $APP/supabase/seed.sql ] && [ "${SEED:-1}" = "1" ]; then echo seed; $PG -f $APP/supabase/seed.sql; fi
fi
cat > logs/postgrest.conf <<CONF
db-uri = "postgres://authenticator:postgres@127.0.0.1:54322/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 54330
db-pool = 10
CONF
nohup ./postgrest logs/postgrest.conf > logs/postgrest.log 2>&1 &
setsid nohup node gateway.js > logs/gateway.log 2>&1 &
sleep 1.5
echo "auth: $(curl -s http://127.0.0.1:54321/auth/v1/health | head -c 80)"
echo "rest: $(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ANON_KEY" http://127.0.0.1:54321/rest/v1/)"
echo "storage: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/status)"
