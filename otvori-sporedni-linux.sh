#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_MAIN_IP="192.168.1.3"
MAIN_IP="${1:-}"

echo "CourtFlow - sporedni laptop"
echo "Na glavnom racunaru prvo pokreni aplikaciju."
echo

if [[ -z "$MAIN_IP" ]]; then
  read -r -p "IP glavnog racunara [${DEFAULT_MAIN_IP}]: " MAIN_IP
  MAIN_IP="${MAIN_IP:-$DEFAULT_MAIN_IP}"
fi

APP_URL="http://${MAIN_IP}:3000/tournaments?server=http://${MAIN_IP}:3000"

open_url() {
  local url="$1"

  if command -v xdg-open >/dev/null 2>&1; then
    nohup xdg-open "$url" >/dev/null 2>&1 &
  elif command -v gio >/dev/null 2>&1; then
    nohup gio open "$url" >/dev/null 2>&1 &
  else
    echo "Otvori rucno u browseru: $url"
    return
  fi

  echo "Otvaram $url"
}

open_url "$APP_URL"

