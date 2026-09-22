#!/bin/sh
# SandLoader easy install for Linux.
# Run: bash Easy-Install-Linux.sh
# Or paste the game folder: bash Easy-Install-Linux.sh /path/to/Sandustry
# Node.js 18+ is downloaded into vendor/node only when it is missing.
# Git is not used.
set -e
cd "$(dirname "$0")"
ROOT=$(pwd)

gold=$(printf '\033[38;2;255;231;0m')
dim=$(printf '\033[38;2;148;163;184m')
okc=$(printf '\033[38;2;74;222;128m')
bad=$(printf '\033[38;2;248;113;113m')
off=$(printf '\033[0m')

banner() {
  printf '\n  %sSANDLOADER%s\n' "$gold" "$off"
  printf '  %sInstall for Sandustry%s\n' "$dim" "$off"
  printf '  %s------------------------------------------------------------%s\n' "$dim" "$off"
  printf '  %sSteam, GOG, and standalone copies. No Git, and no separate Node.js setup.%s\n\n' "$dim" "$off"
}

row() {
  printf '  %-10s %s%s%s\n' "$1" "$2" "$3" "$off"
}

node_ok() {
  exe=$1
  [ -x "$exe" ] || return 1
  ver=$("$exe" -p "process.versions.node" 2>/dev/null) || return 1
  major=${ver%%.*}
  [ "$major" -ge 18 ] 2>/dev/null
}

pick_node() {
  if command -v node >/dev/null 2>&1; then
    sys=$(command -v node)
    if node_ok "$sys"; then
      ver=$("$sys" -p "process.versions.node" 2>/dev/null)
      printf '  %-10s %s\n' "node" "v${ver} is already installed. Not downloading." >&2
      printf '%s\n' "$sys"
      return
    fi
    old=$("$sys" -p "process.versions.node" 2>/dev/null || printf 'unknown')
    printf '  %-10s %s\n' "node" "v${old} is older than 18. Downloading a separate copy. The installed one is left as it is." >&2
  fi
  if node_ok "$ROOT/vendor/node/bin/node"; then
    printf '%s\n' "$ROOT/vendor/node/bin/node"
    return
  fi
  printf '  %-10s %s\n' "node" "Downloading the official build (once)..." >&2
  os=$(uname -s)
  mach=$(uname -m)
  case "$os" in
    Darwin) plat=darwin ;;
    Linux) plat=linux ;;
    *) printf '  %sThis file is for Linux and macOS. On Windows, double-click Easy-Install-Windows.bat.%s\n' "$bad" "$off" >&2
       exit 1 ;;
  esac
  case "$mach" in
    x86_64|amd64) arch=x64 ;;
    arm64|aarch64) arch=arm64 ;;
    *) printf '  %sUnsupported CPU: %s%s\n' "$bad" "$mach" "$off" >&2; exit 1 ;;
  esac
  ver=$(curl -fsSL https://nodejs.org/dist/index.json | sed 's/},{/\n/g' | grep '"lts":"' | head -n 1 | sed -n 's/.*"version":"\(v[^"]*\)".*/\1/p')
  if [ -z "$ver" ]; then
    printf '  %sCould not read the Node.js version list.%s\n' "$bad" "$off" >&2
    exit 1
  fi
  name="node-${ver}-${plat}-${arch}.tar.gz"
  url="https://nodejs.org/dist/${ver}/${name}"
  tmp=$(mktemp)
  curl -fL "$url" -o "$tmp"
  expected=$(curl -fsSL "https://nodejs.org/dist/${ver}/SHASUMS256.txt" | awk -v n="$name" '$2==n || $2==("*" n){print $1; exit}')
  if [ -z "$expected" ]; then
    printf '  %sNo checksum published for %s.%s\n' "$bad" "$name" "$off" >&2
    exit 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$tmp" | awk '{print $1}');
  else actual=$(shasum -a 256 "$tmp" | awk '{print $1}'); fi
  if [ "$actual" != "$expected" ]; then
    printf '  %sChecksum failed. Nothing was installed.%s\n' "$bad" "$off" >&2
    exit 1
  fi
  mkdir -p "$ROOT/vendor"
  rm -rf "$ROOT/vendor/node"
  tar -xzf "$tmp" -C "$ROOT/vendor"
  rm -f "$tmp"
  unpacked=$(echo "$ROOT"/vendor/node-"${ver}"-"${plat}"-"${arch}")
  mv "$unpacked" "$ROOT/vendor/node"
  printf '%s\n' "$ROOT/vendor/node/bin/node"
}

banner
NODE=$(pick_node)
row "node" "$okc" "$NODE"

if [ -n "$1" ]; then
  game=$1
  if [ -f "$game" ]; then game=$(dirname "$game"); fi
  export SANDUSTRY_DIR=$game
fi

found=$("$NODE" -e "const l=require('./src/asar/locate'); const r=l.tryLocate(); if(!r.ok) process.exit(2); process.stdout.write(r.install.root+'|'+r.install.version);") || found=""
if [ -z "$found" ]; then
  row "game" "$bad" "Not found automatically."
  printf '  Paste the folder that contains the game (Steam, GOG, or a standalone copy).\n  '
  read -r typed
  if [ -f "$typed" ]; then typed=$(dirname "$typed"); fi
  export SANDUSTRY_DIR=$typed
  found=$("$NODE" -e "const l=require('./src/asar/locate'); const r=l.tryLocate(); if(!r.ok) process.exit(2); process.stdout.write(r.install.root+'|'+r.install.version);") || found=""
fi

if [ -z "$found" ]; then
  row "game" "$bad" "Still not found. Nothing was changed."
  exit 1
fi

row "game" "$okc" "Sandustry ${found#*|}"
row "folder" "" "${found%%|*}"
printf '\n'
"$NODE" "$ROOT/install.js" --no-steamcmd
printf '\n'
row "status" "$okc" "Installed. Start Sandustry, then press ^ or F1."
printf '  Leave this folder where it is. The game starts the loader from here.\n'
