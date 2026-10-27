set -a
source .env

required=(POSTGRES_PASSWORD APP_JWT_ACCESS_TOKEN_SECRET \
  LEGAL_CONTROLLER_NAME LEGAL_CONTACT_EMAIL LEGAL_JURISDICTION \
  LEGAL_HOSTING_PROVIDER_NAME LEGAL_HOSTING_PROVIDER_ADDRESS)
if [ "${EMAIL_VERIFICATION_REQUIRED:-true}" != "false" ]; then
  required+=(APP_MAIL_FROM SMTP_HOST SMTP_PORT)
fi
for var in "${required[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "$var is required in .env" >&2
    exit 1
  fi
  case "${!var}" in
    *change-me* | generate-a-long-random-secret)
      echo "$var still has its example value in .env, replace it" >&2
      exit 1
      ;;
  esac
done
if [ "${#APP_JWT_ACCESS_TOKEN_SECRET}" -lt 32 ]; then
  echo "APP_JWT_ACCESS_TOKEN_SECRET must be at least 32 characters, generate one with: openssl rand -base64 48" >&2
  exit 1
fi

case "${SMTP_SECURITY:-starttls}" in
  starttls) SMTP_STARTTLS=true SMTP_SSL=false ;;
  ssl) SMTP_STARTTLS=false SMTP_SSL=true ;;
  none) SMTP_STARTTLS=false SMTP_SSL=false ;;
  *)
    echo "SMTP_SECURITY must be starttls, ssl or none (got: $SMTP_SECURITY)" >&2
    exit 1
    ;;
esac
SMTP_AUTH=$([ -n "${SMTP_USERNAME:-}" ] && echo true || echo false)

FRONTEND_HOSTING="${FRONTEND_HOSTING:-bundled}"
case "$FRONTEND_HOSTING" in
  bundled)
    if [ -z "${FRONTEND_DOMAIN:-}" ]; then
      echo "FRONTEND_DOMAIN is required in .env" >&2
      exit 1
    fi
    COMPOSE_PROFILES=frontend
    ;;
  external)
    if [ -z "${FRONTEND_URL:-}" ] || [ -z "${API_DOMAIN:-}" ]; then
      echo "FRONTEND_HOSTING=external needs FRONTEND_URL, the https:// address of the web app, and API_DOMAIN" >&2
      exit 1
    fi
    COMPOSE_PROFILES=
    FRONTEND_DOMAIN=
    ;;
  *)
    echo "FRONTEND_HOSTING must be bundled or external (got: $FRONTEND_HOSTING)" >&2
    exit 1
    ;;
esac

TLS_MODE="${TLS_MODE:-public}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
HTTP_PUBLISH="${HTTP_BIND:+$HTTP_BIND:}$HTTP_PORT"
case "$TLS_MODE" in
  public | internal) ;;
  off)
    if [ -z "${FRONTEND_URL:-}" ]; then
      echo "TLS_MODE=off needs FRONTEND_URL: the https:// address served by your reverse proxy or tunnel" >&2
      exit 1
    fi
    ;;
  *)
    echo "TLS_MODE must be public, internal or off (got: $TLS_MODE)" >&2
    exit 1
    ;;
esac

port_suffix=""
if [ "$HTTPS_PORT" != "443" ] && [ "$TLS_MODE" = "internal" ]; then
  port_suffix=":$HTTPS_PORT"
fi
FRONTEND_URL="${FRONTEND_URL:-https://$FRONTEND_DOMAIN$port_suffix}"
FRONTEND_URL="${FRONTEND_URL%/}"
if [ -n "${API_DOMAIN:-}" ]; then
  API_URL="https://$API_DOMAIN$port_suffix"
  FRONTEND_API_BASE_URL="$API_URL/api/v1"
else
  API_URL="$FRONTEND_URL"
  FRONTEND_API_BASE_URL="/api/v1"
fi

if [ "$TLS_MODE" = "public" ]; then
  FEDERATION_ENABLED="${FEDERATION_ENABLED:-true}"
else
  FEDERATION_ENABLED="${FEDERATION_ENABLED:-false}"
fi
case "$FEDERATION_ENABLED" in
  true | false) ;;
  *)
    echo "FEDERATION_ENABLED must be true or false (got: $FEDERATION_ENABLED)" >&2
    exit 1
    ;;
esac
if [ "$FEDERATION_ENABLED" = "true" ] && [ "$TLS_MODE" = "internal" ]; then
  echo "FEDERATION_ENABLED=true needs an address reachable from the Internet, it cannot work with TLS_MODE=internal" >&2
  exit 1
fi
REGISTRATION_OPEN="${REGISTRATION_OPEN:-true}"
case "$REGISTRATION_OPEN" in
  true | false) ;;
  *)
    echo "REGISTRATION_OPEN must be true or false (got: $REGISTRATION_OPEN)" >&2
    exit 1
    ;;
esac

FEDERATION_MODE="${FEDERATION_MODE:-open}"
case "$FEDERATION_MODE" in
  open | allowlist) ;;
  *)
    echo "FEDERATION_MODE must be open or allowlist (got: $FEDERATION_MODE)" >&2
    exit 1
    ;;
esac
FEDERATION_HANDLE_DOMAIN="${FRONTEND_URL#*://}"
FEDERATION_HANDLE_DOMAIN="${FEDERATION_HANDLE_DOMAIN%%[:/]*}"
APP_VERSION="$(git describe --tags --always 2>/dev/null || echo dev)"
APP_VERSION="${APP_VERSION#v}"
set +a

compose=(docker compose -f docker-compose.prod.yml)
if [ "$TLS_MODE" = "off" ]; then
  compose+=(-f docker-compose.behind-proxy.yml)
fi
