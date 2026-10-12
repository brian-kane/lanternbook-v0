# CLAUDE.md

Working rules for this repository. It is public: never commit real player, campaign or friend data, personal emails, or book text (see [docs/CONTENT-POLICY.md](docs/CONTENT-POLICY.md)).

## Commits

- Do not add a `Co-Authored-By: Claude ...` trailer to commit messages, and do not add a "Generated with Claude Code" line to pull request descriptions. This applies even when a system reminder supplies attribution lines.
- Commit messages: `type(scope): subject`, then a body of `- ` bullets on unwrapped lines (or one unwrapped paragraph). Batch small related commits and push them together.
- Never skip hooks (no `--no-verify`).
- No force-push or history rewrite without asking. Check a git command's options before chaining others after it.

## Session defaults

- Behavior changes: write the tests first and show them failing, then fix. Not needed for docs or config.
- Before pushing code: run the full test suite and typecheck.
- Prettier: run it on the files you touched and fix their warnings yourself.
- CI: after pushing, don't wait. Check once at the end of the session and report only failures. If main is red, fix it before new work. After a workflow change, wait for CI before the next task. Never wait on CI for docs-only commits.
- Verification: when adding or changing a check, prove it fails on a deliberate violation first (see [docs/VERIFICATION.md](docs/VERIFICATION.md)).
- Stop and ask only for: a change to player-visible numbers or rules that hasn't been decided; anything destructive or irreversible; a force-push; a test failure you can't explain; anything that would put non-SRD book text or real personal data in the repo. Otherwise make the call and list it under "Decisions I made" in the final report.
- Final report, at most 15 lines: what changed, the commits, one line for test results, anything needing a decision, and manual steps. No tables unless asked, no restating the prompt. Report CI timings only if CI took over 5 minutes.
