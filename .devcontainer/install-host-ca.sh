#!/usr/bin/env bash
# Trusts the host's extra CA certificates inside the container, for networks behind a
# TLS-inspecting proxy. Usage: sudo bash install-host-ca.sh <dir>. A missing or empty <dir> is a
# no-op. Safe to run repeatedly. See docs/DEV-CONTAINER.md.
#
# Every certificate in every .crt/.pem file under <dir> is copied to its own host-*.crt file:
# update-ca-certificates only reads .crt files, and `openssl rehash` skips files holding more than
# one certificate. Only CERTIFICATE blocks are extracted, so keys in a .pem are never copied.
set -euo pipefail

src="${1:?usage: install-host-ca.sh <dir>}"
dest="${HOST_CA_DEST:-/usr/local/share/ca-certificates}"

shopt -s nullglob
stale=("$dest"/host-*.crt)
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [ -d "$src" ]; then
  while IFS= read -r -d '' file; do
    rel="${file#"$src"/}"
    name="host-${rel//[^A-Za-z0-9._-]/_}"
    awk -v prefix="$tmp/$name" '
      { sub(/\r$/, "") }
      /^-----BEGIN CERTIFICATE-----$/ { n++; out = sprintf("%s-%03d.crt", prefix, n) }
      out { print > out }
      /^-----END CERTIFICATE-----$/ { close(out); out = "" }
    ' "$file"
  done < <(find "$src" -type f \( -name '*.crt' -o -name '*.pem' \) -print0 | sort -z)
fi

pieces=()
for piece in "$tmp"/host-*.crt; do
  if openssl x509 -in "$piece" -noout 2>/dev/null; then
    pieces+=("$piece")
  else
    echo "WARNING: skipping ${piece#"$tmp"/}: not a valid X.509 certificate" >&2
  fi
done

if [ ${#pieces[@]} -eq 0 ] && [ ${#stale[@]} -eq 0 ]; then
  echo "No host CA certificates in $src; nothing to do."
  exit 0
fi

rm -f "${stale[@]}"
for piece in "${pieces[@]}"; do
  install -m 0644 "$piece" "$dest/"
  echo "Trusting ${piece#"$tmp"/}: $(openssl x509 -in "$piece" -noout -subject -fingerprint -sha256 | paste -sd ' ')"
done
update-ca-certificates --fresh
echo "Installed ${#pieces[@]} host CA certificate(s) from $src"
