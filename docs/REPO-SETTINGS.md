# Repo settings checklist

These are GitHub settings to click through in the web UI. Nothing here is applied by code. Paths are under **Settings** of the repository unless noted.

- [ ] **Secret scanning and push protection**
  - Where: Code security, then Secret protection (or Secret scanning).
  - Why: finds known secret formats in the repo and blocks a push that contains one. This is a public repo, so a leaked secret is public at once.
  - Verify: both show Enabled. Pushing a documented example token from a throwaway branch should be blocked; if you try this, use a branch you delete afterwards.
- [ ] **Private vulnerability reporting**
  - Where: Code security, then Private vulnerability reporting.
  - Why: [SECURITY.md](../SECURITY.md) tells people to use it, and no email address is published.
  - Verify: it shows Enabled. As a logged-out or other-account viewer, the Security tab shows "Report a vulnerability".
- [ ] **Dependabot alerts and security updates**
  - Where: Code security, then Dependabot alerts and Dependabot security updates.
  - Why: warns about vulnerable dependencies and opens fix PRs. Version updates for github-actions come from [.github/dependabot.yml](../.github/dependabot.yml). Add npm there once there is a package.json.
  - Verify: both show Enabled. Insights, then Dependency graph, then Dependabot lists the github-actions ecosystem after its first run.
- [ ] **Actions default workflow permissions: read-only**
  - Where: Actions, then General, then Workflow permissions: "Read repository contents and packages permissions".
  - Why: a workflow that forgets to declare permissions gets no write access. [ci.yml](../.github/workflows/ci.yml) also declares `contents: read` itself.
  - Verify: the option is selected after saving and reload.
- [ ] **Fork pull request workflows need approval for all external contributors**
  - Where: Actions, then General, then "Approval for running fork pull request workflows from contributors": "Require approval for all external contributors" (older UI: "Fork pull request workflows from outside collaborators", "Require approval for all outside collaborators").
  - Why: stops a stranger's PR from running workflows on this repo without a look first.
  - Verify: the option is selected after saving and reload.
- [ ] **"Allow GitHub Actions to create and approve pull requests" is off**
  - Where: Actions, then General, then Workflow permissions.
  - Why: a workflow should not be able to open or approve PRs.
  - Verify: the checkbox is cleared after saving and reload.
- [ ] **Ruleset "main v1": block force pushes and deletion only**
  - Where: Rules, then Rulesets, then New branch ruleset. Name: main v1. Enforcement: Active. Target: the default branch. Enable only "Restrict deletions" and "Block force pushes".
  - Why: protects history from accidents. There is no PR step, so do not enable "Require a pull request" or required status checks.
  - Verify: from a clone, `git push --force origin HEAD:main` (after a harmless local amend) and `git push origin :main` are both rejected. Do not try these on a branch you care about; use a throwaway commit and expect rejection.
  - Later: required status checks (gitleaks, actionlint, prettier) force every change through a PR. Add them if we adopt PRs.

- [x] **Require actions to be pinned to a full-length commit SHA** (turned on by you)
  - Where: Actions, then General, then Actions permissions, then "Require actions to be pinned to a full-length commit SHA".
  - Why: a tag such as `actions/checkout@v4` can be moved to different code. A SHA cannot.
  - Verify: push a workflow that uses an action by tag. GitHub refuses to start it. Proven on 2026-10-12 with the throwaway branch `ci-plant/c-tag-ref` (now deleted): the run of `plant-tag` ended with conclusion `startup_failure`, had no jobs and no check runs ([run](https://github.com/brian-kane/lanternbook/actions/runs/38284835190)), while the SHA-pinned `CI` workflow on the same branch family ran normally. The API does not return the refusal; the run page in the browser shows this annotation, recorded on 2026-10-12 (run 38284835190, branch `ci-plant/c-tag-ref`, commit `e1ff611`):

    > The action actions/checkout@v4 is not allowed in brian-kane/lanternbook because all actions must be from a repository owned by brian-kane or created by GitHub. All actions must also be pinned to a full-length commit SHA.

  - Which rule refused it: `actions/checkout` is created by GitHub, so the allow-list below permits it. The refusal came from the SHA-pinning requirement; the message names both rules because both are on.

- [x] **Actions allow-list: this repository's owner and GitHub-created actions only**
  - Where: Actions, then General, then Actions permissions: "Allow brian-kane, and select non-brian-kane, actions and reusable workflows", with "Allow actions created by GitHub" ticked and no other patterns listed.
  - Why: a third-party action is code from a stranger running with this repo's token. Anything else needs a deliberate entry here first.
  - Verify: the run C annotation above quotes this rule ("must be from a repository owned by brian-kane or created by GitHub"). A direct proof would be a SHA-pinned third-party action on a throwaway branch; GitHub should refuse to start it.

- [ ] **Pages publishes from GitHub Actions**
  - Where: Pages, then Build and deployment, then Source: "GitHub Actions".
  - Why: the `deploy` job in [ci.yml](../.github/workflows/ci.yml) publishes the built site; there is no branch to publish from.
  - Verify: the Pages page shows Source: GitHub Actions, and after the next push to main it shows "Your site is live at https://brian-kane.github.io/lanternbook/". The `deploy` job of that CI run is green and links to the same URL.
- [ ] **The `github-pages` environment deploys from main only**
  - Where: Environments, then `github-pages` (created when the source above is set), then Deployment branches and tags: "Selected branches and tags", with one rule for `main`. Remove any other rule.
  - Why: a second lock behind the job's own `if:`. Even a workflow change that let a branch run `deploy` could not publish from it.
  - Verify: the environment lists exactly one deployment branch rule, `main`. In Settings, then Environments, the `github-pages` deployment history shows only `main`.

## After there is code

- [ ] **CodeQL default setup**: Code security, then Code scanning, then set up Default. Not useful until there is code to analyse.
