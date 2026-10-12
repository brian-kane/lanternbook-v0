# Reading CI results

The repository is public, so no token is needed.

- Browser: <https://github.com/brian-kane/lanternbook/actions>. Each run lists its jobs; open one for its log. Failed jobs also show their errors as annotations on the run page.
- Unauthenticated API (rate-limited to 60 requests an hour):
  - Runs: `curl -s 'https://api.github.com/repos/brian-kane/lanternbook/actions/runs?branch=main&per_page=5'`
  - Jobs of a run: `curl -s https://api.github.com/repos/brian-kane/lanternbook/actions/runs/<run id>/jobs`
  - A job's failure messages: `curl -s <check_run_url>/annotations`, with `check_run_url` taken from the jobs response.
  - Raw job logs need a login, so use the browser for those.

## Jobs

- `gitleaks`: scans only history reachable from the commit under test, and fails if it scanned zero commits or a different number than expected.
- `actionlint`, `prettier`, `lint`, `typecheck`, `test`, `build`, `perf-budget`: each fails if it examined nothing.
- `audit-prod` is blocking. `audit-all` is allowed to fail and only keeps dev-dependency advisories visible.
