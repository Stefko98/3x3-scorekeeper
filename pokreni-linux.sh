#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_PATH="${BASH_SOURCE[0]}"
SOURCE_DIR="${SOURCE_PATH%/*}"
[[ "$SOURCE_DIR" == "$SOURCE_PATH" ]] && SOURCE_DIR="."
APP_DIR="$(CDPATH= cd -- "$SOURCE_DIR" && pwd)"
APP_URL="http://localhost:3000/tournaments"
RUNTIME_DIR="$APP_DIR/.courtflow-runtime"
NODE_VERSION="24.16.0"
LOG_FILE="$APP_DIR/.courtflow-server.log"
PID_FILE="$APP_DIR/.courtflow-server.pid"

echo "Pokrecem CourtFlow 3x3 Organizator..."
echo "Ovaj fajl pokreci samo na glavnom racunaru."
echo

if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "Ne mogu da pronadjem package.json u folderu:"
  echo "$APP_DIR"
  exit 1
fi

open_url() {
  local url="$1"

  if command -v xdg-open >/dev/null 2>&1; then
    nohup xdg-open "$url" >/dev/null 2>&1 &
  elif command -v gio >/dev/null 2>&1; then
    nohup gio open "$url" >/dev/null 2>&1 &
  else
    echo "Otvori rucno u browseru: $url"
  fi
}

fetch_page() {
  local url="$1"

  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 4 "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=4 "$url"
  else
    return 1
  fi
}

app_is_running() {
  local page
  page="$(fetch_page "http://127.0.0.1:3000" 2>/dev/null || true)"
  [[ "$page" == *"CourtFlow"* || "$page" == *"3x3 Organizator"* ]]
}

port_is_busy() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '$4 ~ /:3000$/ { found = 1 } END { exit !found }'
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

node_is_compatible() {
  command -v node >/dev/null 2>&1 &&
    command -v npm >/dev/null 2>&1 &&
    node -e '
      const [major, minor] = process.versions.node.split(".").map(Number);
      process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1);
    '
}

install_portable_node() {
  local machine_arch node_arch archive node_home download_url
  machine_arch="$(uname -m)"

  case "$machine_arch" in
    x86_64|amd64)
      node_arch="x64"
      ;;
    aarch64|arm64)
      node_arch="arm64"
      ;;
    *)
      echo "Linux arhitektura '$machine_arch' trenutno nije podrzana."
      echo "Instaliraj Node.js 20.9 ili noviji i ponovo pokreni skriptu."
      exit 1
      ;;
  esac

  archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
  node_home="$RUNTIME_DIR/node-v${NODE_VERSION}-linux-${node_arch}"
  download_url="https://nodejs.org/dist/v${NODE_VERSION}/${archive}"

  if [[ ! -x "$node_home/bin/node" ]]; then
    echo "Node.js 20.9+ nije pronadjen. Preuzimam lokalni Node.js runtime..."
    mkdir -p "$RUNTIME_DIR"

    if command -v curl >/dev/null 2>&1; then
      curl -fL "$download_url" -o "$RUNTIME_DIR/$archive"
    elif command -v wget >/dev/null 2>&1; then
      wget -O "$RUNTIME_DIR/$archive" "$download_url"
    else
      echo "Za automatsko preuzimanje potreban je curl ili wget."
      echo "Na Linux Mint/Ubuntu sistemu pokreni: sudo apt install curl"
      exit 1
    fi

    if ! tar -xJf "$RUNTIME_DIR/$archive" -C "$RUNTIME_DIR"; then
      echo "Raspakivanje Node.js runtime-a nije uspelo."
      echo "Na Linux Mint/Ubuntu sistemu pokreni: sudo apt install xz-utils"
      exit 1
    fi

    rm -f "$RUNTIME_DIR/$archive"
  fi

  export PATH="$node_home/bin:$PATH"
}

if app_is_running; then
  echo "CourtFlow server vec radi."
  open_url "$APP_URL"
  exit 0
fi

if port_is_busy; then
  echo "Port 3000 koristi drugi program."
  echo "Zatvori taj program, pa ponovo pokreni ovu skriptu."
  exit 1
fi

if ! node_is_compatible; then
  install_portable_node
fi

echo "Node.js: $(node --version)"

machine_arch="$(uname -m)"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
lock_signature="$(cksum "$APP_DIR/package-lock.json" | awk '{ print $1 "-" $2 }')"
dependency_signature="${machine_arch}-node${node_major}-${lock_signature}"
dependency_marker="$APP_DIR/node_modules/.courtflow-linux-install"

if [[ ! -f "$dependency_marker" ]] ||
  [[ "$(cat "$dependency_marker" 2>/dev/null || true)" != "$dependency_signature" ]]; then
  echo "Pripremam Linux pakete aplikacije..."
  (
    cd "$APP_DIR"
    npm ci
  )
  printf '%s\n' "$dependency_signature" >"$dependency_marker"
fi

echo "Pravim produkcionu verziju aplikacije..."
(
  cd "$APP_DIR"
  npm run build
)

echo "Pokrecem server..."
(
  cd "$APP_DIR"
  nohup npm run start -- -H 0.0.0.0 -p 3000 >"$LOG_FILE" 2>&1 &
  echo "$!" >"$PID_FILE"
)

server_ready=0
for _ in $(seq 1 40); do
  if app_is_running; then
    server_ready=1
    break
  fi

  if [[ -f "$PID_FILE" ]] && ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    break
  fi

  sleep 1
done

if [[ "$server_ready" -ne 1 ]]; then
  echo "Server nije uspeo da se pokrene. Poslednje poruke:"
  tail -n 30 "$LOG_FILE" 2>/dev/null || true
  exit 1
fi

network_ip="$(hostname -I 2>/dev/null | awk '{ print $1 }')"

echo
echo "CourtFlow radi na: $APP_URL"
if [[ -n "$network_ip" ]]; then
  echo "Na sporednom laptopu otvori: http://${network_ip}:3000"
fi

open_url "$APP_URL"
