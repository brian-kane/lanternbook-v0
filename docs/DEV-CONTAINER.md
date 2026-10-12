# Dev container

## Behind a TLS-inspecting proxy

A TLS-inspecting proxy re-signs HTTPS traffic with its own CA. The host trusts that CA, but a fresh container does not, so the first download fails. In `scripts/setup.sh` that shows up as curl exit 60, `SSL certificate problem: self-signed certificate in certificate chain`. To confirm, run this inside the container:

```sh
openssl s_client -connect github.com:443 -servername github.com -showcerts </dev/null
```

If the top certificate's issuer is not a public CA but your network's inspection CA, this section applies. Never work around it by turning verification off (`curl -k`, `strict-ssl=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, `GIT_SSL_NO_VERIFY`).

### How the container picks up the host's CAs

- `devcontainer.json` bind-mounts the host's `/usr/local/share` read-only at `/mnt/host-usr-local-share`. The parent is mounted rather than `ca-certificates` itself because it exists on every Linux or WSL host, so a host without that directory still starts the container. It is mounted beside, never over, the container's own CA directory.
- `onCreateCommand` first runs `.devcontainer/install-host-ca.sh` with sudo on `/mnt/host-usr-local-share/ca-certificates`, before `scripts/setup.sh`, corepack and `pnpm install`. The script copies each certificate from each `.crt`/`.pem` file there into its own `host-*.crt` file, checks each with `openssl x509`, skips anything invalid with a warning, removes `host-*.crt` files left by an earlier run, and runs `update-ca-certificates --fresh`. If there is no directory, or it has no certificates, it prints one line and does nothing.
- `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` is set in `containerEnv`, because Node, and so corepack, pnpm and npm, ignores the system store otherwise.

Features in `devcontainer.json` install while the image builds, before any mount exists, so this does not help a feature that downloads during the build.

### Setting up the host

Put the proxy's root CA, in PEM format, in `/usr/local/share/ca-certificates/` on the host with a `.crt` extension, run `sudo update-ca-certificates` there, then run **Dev Containers: Rebuild Container**. On WSL, "the host" is the WSL distro that VS Code opens the folder from, not Windows. Get the CA certificate from your network's administrator, not from the `openssl s_client` output, which only shows what the network presents.

If the host has no `/usr/local/share/ca-certificates`, as on hosts that keep CAs elsewhere, the container still builds and the install step does nothing. If you are behind a proxy, create that directory with `sudo mkdir -p`, add the CA as above and rebuild. If you are not behind one, there is nothing to do.

### Nothing certificate-related is committed

No certificate, key or fingerprint is stored in this repository; the container only reads the host's files at creation time. `scripts/check-ca-scripts.mjs`, run by `pnpm lint`, tests the install script and `setup.sh` with throwaway certificates it creates in a temporary directory and deletes afterwards.
