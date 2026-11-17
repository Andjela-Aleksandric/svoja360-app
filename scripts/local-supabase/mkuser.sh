#!/usr/bin/env bash
# mkuser.sh email password "Full Name"
source /opt/sb/keys.env
curl -s -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "content-type: application/json" \
  -d "{\"email\":\"$1\",\"password\":\"$2\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$3\"}}" | head -c 200; echo
