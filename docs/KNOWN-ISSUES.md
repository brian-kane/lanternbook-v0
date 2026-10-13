# Known issues

## TypeScript is pinned to 6.0.3

- What: `typescript` stays at 6.0.3 because typescript-eslint 8.71.1 declares a peer range of `>=4.8.4 <6.1.0`. Dependabot ignores TypeScript major and minor updates, so only 6.0.x patches come through; see the comment in [.github/dependabot.yml](../.github/dependabot.yml).
- Revisit: when typescript-eslint supports TypeScript 7 (its `peerDependencies.typescript` range includes 7), lift the Dependabot ignore and update both together. Whichever typescript-eslint release first allows 6.1 also ends the minor ignore.

## Saved widgets share an origin with every other Pages site of this account

- What: the site is served from `https://<owner>.github.io/lanternbook/`. Browser storage is per origin, and `<owner>.github.io` is the origin of every GitHub Pages project site this account publishes. Any of those sites can read, overwrite or clear lanternbook's saved widgets, and lanternbook could do the same to theirs. The service worker is scoped to `/lanternbook/`, but storage is not.
- Mitigation now: every key lanternbook writes starts with `lanternbook:`, so accidental collisions are unlikely. That does not stop a site that reads or clears storage on purpose, and nothing sensitive should be stored.
- Fix: serve the app from its own origin (a custom domain for this repo's Pages, or another static host). Revisit before the app stores anything that matters, or before other Pages sites with scripts are published from the same account.

## @types/node stays on the Node major

- Bump `@types/node` to a new major only together with the Node major in the dev container image, `.nvmrc` and `package.json` engines; Dependabot ignores its majors until then (see [.github/dependabot.yml](../.github/dependabot.yml)).

## pnpm comes from the image's global install, not from corepack

- What: the base image puts its global pnpm 10.15.1 (`/usr/local/share/npm-global/bin`) ahead of `/usr/local/bin` on PATH, so the corepack shim that `sudo corepack enable` creates is never reached. The `packageManager` pin in package.json still applies, but through pnpm switching itself to 12.11.2 under `~/.local/share/pnpm/.tools/`, not through corepack.
- Side effect: that self-switch writes a build-script allowlist naming `@pnpm/exe`, while pnpm 12 runs its native-binary install script from the `pnpm` package itself, so the script is skipped and pnpm runs through Node. The postCreate log says "pnpm is running through Node.js because the script that installs its native binary was skipped." It works, with a slower start.
- Fix: remove the global pnpm from the image, or reorder PATH so `/usr/local/bin` comes first; either needs a container rebuild and a check that `pnpm --version` prints 12.11.2 from the corepack shim.

## pnpm's 7-day minimum release age is not set yet

- What: Dependabot waits 7 days before proposing an npm update (`cooldown` in [.github/dependabot.yml](../.github/dependabot.yml)), but pnpm still uses its built-in `minimumReleaseAge` of 1440 minutes (1 day). Setting `minimumReleaseAge: 10080` in `pnpm-workspace.yaml` today makes `pnpm install --frozen-lockfile` fail with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`: 60 lockfile entries were published within the last 7 days, the newest at 2026-10-11 05:57 UTC.
- When: from 2026-10-18 06:00 UTC every current entry is old enough, provided nothing newer is added before then.
- Fix: add `pnpm-workspace.yaml` with `minimumReleaseAge: 10080`, run `pnpm install --frozen-lockfile` to confirm it passes, then remove this entry.
