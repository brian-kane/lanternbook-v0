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
- [ ] **Fork pull request workflows need approval**
  - Where: Actions, then General, then Fork pull request workflows from outside collaborators: require approval for all outside collaborators.
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

## After there is code

- [ ] **CodeQL default setup**: Code security, then Code scanning, then set up Default. Not useful until there is code to analyse.
