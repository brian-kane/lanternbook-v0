# Is this check actually running?

A check that passes by examining nothing looks exactly like a check that works. The usual causes are a glob that matches no files, a config that lists no inputs, a missing secret, a threshold that isn't set, and a command run from the wrong directory.

## The practice

**When you add or change a verification step, prove it fails on a deliberate violation before trusting it.** Plant something it must catch, run it, see it fail for that reason, then revert. A check that has never been seen failing has not been shown to work. A check made of several steps needs one plant per step.

**A check must fail loudly on missing or malformed input, never proceed as if there were nothing to check.** Treat each required input as a precondition: no files matched, no commits scanned, no workflows found, no budget configured, zero tests collected. Exit non-zero with a message naming what is missing.

## Checklist

1. Has anyone seen it fail? If not, plant a violation.
2. Does it report what it covered? Look for a count of files, commits or tests.
3. Is it suspiciously fast or quiet? An instant, silent pass needs explaining.
4. What does it actually load? Check the config, working directory and inputs it really uses.
5. When was it last a different colour? A permanently red check carries no signal; fix it or make it explicitly non-blocking with the reason recorded.
6. Read the failure, not the colour. A crashed scanner is not a findings report.
7. Does it measure what I think it measures? Compare its number with an independent measurement now and then, and whenever the toolchain changes.

## CI jobs and their plants

Each CI job fails when it checks nothing (zero commits, zero workflows, zero files) and was proven on a throwaway branch, never main:

- gitleaks: a fake secret from gitleaks' own documented examples must fail the job.
- actionlint: a broken workflow file must fail the job.
- prettier: a misformatted markdown file must fail the job.

Findings from proving them:

- The first gitleaks job passed a leak: GitHub's default `bash -e` has no `pipefail`, so `gitleaks | tee` hid the exit code. The step now sets `shell: bash`.
- gitleaks scans every ref, not only the checked-out branch. While a plant branch holds a fake secret, the gitleaks job is red on every branch; delete the plant branch to clear it.
