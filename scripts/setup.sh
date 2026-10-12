#!/usr/bin/env bash
# Installs the pinned, checksum-verified gitleaks into ~/.local/bin. Safe to run repeatedly.
# Used by the dev container and by hand on a bare WSL/Linux machine.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$root/scripts/tool-versions.env"

bin_dir="${HOME}/.local/bin"
target="$bin_dir/gitleaks"

if [ "$(uname -s)" != "Linux" ] || [ "$(uname -m)" != "x86_64" ]; then
  echo "setup.sh supports Linux x86_64 only (found $(uname -s) $(uname -m)). Install gitleaks ${GITLEAKS_VERSION} by hand." >&2
  exit 1
fi

if [ -x "$target" ] && "$target" version 2>/dev/null | grep -qx "${GITLEAKS_VERSION}"; then
  echo "gitleaks ${GITLEAKS_VERSION} already installed at $target"
else
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
  echo "Downloading $url"
  rc=0
  curl -sSfL --retry 3 --max-time 120 -o "$tmp/gitleaks.tar.gz" "$url" || rc=$?
  if [ "$rc" -eq 60 ]; then
    # Never retry insecurely: the fix is to trust the network's CA, not to skip verification.
    cat >&2 <<'EOF'

setup.sh: this container does not trust the CA that signed github.com's certificate (curl exit 60).
This usually means a TLS-inspecting proxy on your network re-signs HTTPS traffic. Confirm with:
  openssl s_client -connect github.com:443 -servername github.com -showcerts </dev/null
If the issuer is your proxy's CA, install that CA on the host and rebuild the dev container;
the host CA mount does the rest. See docs/DEV-CONTAINER.md.
EOF
    exit "$rc"
  elif [ "$rc" -ne 0 ]; then
    exit "$rc"
  fi
  echo "${GITLEAKS_SHA256_LINUX_X64}  $tmp/gitleaks.tar.gz" | sha256sum -c -
  tar -xzf "$tmp/gitleaks.tar.gz" -C "$tmp" gitleaks
  mkdir -p "$bin_dir"
  install -m 0755 "$tmp/gitleaks" "$target"
  echo "Installed gitleaks ${GITLEAKS_VERSION} to $target"
fi

case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) echo "Note: $bin_dir is not on PATH in this shell. Add it to your profile: export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
esac
