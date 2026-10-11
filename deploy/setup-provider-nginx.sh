#!/usr/bin/env bash
#
# Puts nginx in front of the provider API and gets it a certificate.
#
#   sudo /srv/clinic/repo/deploy/setup-provider-nginx.sh
#
# Run once, after the first successful deploy. add-clinic.sh does the
# equivalent for each clinic; this is the console's own API, which has no
# add-clinic run to do it.
#
# Without this, api.<domain> reaches nginx's default site and returns 404
# while the API is running perfectly on 127.0.0.1 -- which looks like a
# broken deploy and is not one.
set -euo pipefail

ROOT=/srv/clinic
ENV_FILE="$ROOT/env/provider.env"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "Run as root (sudo $0)"
[ -f "$ENV_FILE" ] || die "No $ENV_FILE -- write it before running this."

read_env() {  # read_env <file> <KEY>
  local raw
  raw="$(sed -n "s/^$2=//p" "$1" | head -1)"
  case "$raw" in
    \"*\") raw="${raw#\"}"; raw="${raw%\"}" ;;
    \'*\') raw="${raw#\'}"; raw="${raw%\'}" ;;
  esac
  printf '%s' "$raw"
}

DOMAIN="$(read_env "$ENV_FILE" PLATFORM_DOMAIN)"
PORT="$(read_env "$ENV_FILE" PORT)"
[ -n "$DOMAIN" ] || die "PLATFORM_DOMAIN is not set in $ENV_FILE"
[ -n "$PORT" ] || die "PORT is not set in $ENV_FILE"
HOST="api.$DOMAIN"

log "Configuring nginx for $HOST -> 127.0.0.1:$PORT"

# Confirm the API is actually answering first. Pointing nginx at a dead
# port produces a 502 that reads like an nginx fault rather than a
# service that was never started.
code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:$PORT/health" 2>/dev/null || echo 000)"
[ "$code" = "200" ] || die "The API is not responding on 127.0.0.1:$PORT (got $code). Deploy it before exposing it."
info "API healthy on 127.0.0.1:$PORT"

# Check DNS before asking for a certificate. Let's Encrypt rate-limits
# failures, so it is worth not burning attempts on a hostname that does
# not point here yet.
MYIP="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
RESOLVED="$(getent hosts "$HOST" | awk '{print $1}' | head -1 || true)"
if [ -n "$RESOLVED" ] && [ -n "$MYIP" ] && [ "$RESOLVED" != "$MYIP" ]; then
  info "WARNING: $HOST resolves to $RESOLVED but this server is $MYIP."
  info "         The certificate request will fail until DNS points here."
fi

cat > "/etc/nginx/sites-available/$HOST" <<NGINX
server {
  listen 80;
  server_name $HOST;

  # The console uploads nothing, but keeping this consistent with the
  # clinic vhosts avoids a surprise if that ever changes.
  client_max_body_size 12m;

  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;
  }
}
NGINX

ln -sfn "/etc/nginx/sites-available/$HOST" "/etc/nginx/sites-enabled/$HOST"

# Remove nginx's default site. It owns the catch-all server block, so it
# answers anything without a matching server_name -- which is what makes
# a missing vhost look like a 404 from your own API.
if [ -e /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
  info "removed nginx's default site"
fi

nginx -t > /dev/null 2>&1 || { nginx -t; die "nginx config is invalid"; }
systemctl reload nginx
info "nginx reloaded"

code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $HOST" "http://127.0.0.1/health" || echo 000)"
[ "$code" = "200" ] && info "proxy works over HTTP" || info "WARNING: proxy returned $code over HTTP"

log "Requesting a certificate for $HOST"
if certbot --nginx -d "$HOST" --non-interactive --agree-tos \
     --register-unsafely-without-email --redirect; then
  info "TLS active"
else
  die "certbot failed. Check that $HOST resolves to this server, then re-run."
fi

log "Done"
info "Test it:  curl https://$HOST/health"
