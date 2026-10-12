// Runs scripts/setup.sh and .devcontainer/install-host-ca.sh against stubbed tools and throwaway
// certificates generated in a temp dir, and asserts how each behaves behind a TLS-inspecting proxy.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { reportError } from './ci-annotate.mjs';

const root = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), 'ca-check-'));
const stubs = join(tmp, 'stubs');
const log = join(tmp, 'calls.log');
const problems = [];
let n = 0;

mkdirSync(stubs);

function stub(name, body) {
  const file = join(stubs, name);
  writeFileSync(file, `#!/bin/sh\necho "${name} $*" >> "$CALLLOG"\n${body}\n`);
  chmodSync(file, 0o755);
}

stub(
  'curl',
  'echo "curl: (60) SSL certificate problem: self-signed certificate in certificate chain" >&2\nexit 60',
);
stub('update-ca-certificates', 'exit 0');

function run(script, args, extraEnv = {}) {
  rmSync(log, { force: true });
  const home = mkdtempSync(join(tmp, 'home-'));
  const result = spawnSync('bash', [join(root, script), ...args], {
    encoding: 'utf8',
    env: { PATH: `${stubs}:/usr/bin:/bin`, HOME: home, CALLLOG: log, ...extraEnv },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  return { ...result, calls };
}

function scenario(name, checks) {
  n += 1;
  const failed = checks.filter(([cond]) => !cond).map(([, what]) => `${name}: ${what}`);
  problems.push(...failed);
  console.log(`${failed.length === 0 ? 'ok  ' : 'FAIL'} ${name}`);
}

// setup.sh: an untrusted CA must stop with guidance, and must never retry insecurely.
{
  const r = run('scripts/setup.sh', []);
  const curlCalls = r.calls.filter((c) => c.startsWith('curl '));
  scenario('setup.sh explains curl exit 60 and fails', [
    [r.status !== 0, `expected non-zero exit, got ${r.status}`],
    [
      /does not trust/.test(r.stderr),
      `stderr should say the container does not trust the CA:\n${r.stderr}`,
    ],
    [
      r.stderr.includes('openssl s_client -connect github.com:443'),
      'stderr should give the openssl command',
    ],
    [r.stderr.includes('docs/DEV-CONTAINER.md'), 'stderr should point at docs/DEV-CONTAINER.md'],
    [curlCalls.length === 1, `expected exactly one curl call, saw ${JSON.stringify(curlCalls)}`],
    [
      !curlCalls.some((c) => / (-k|--insecure)\b/.test(c)),
      'curl must never run with -k/--insecure',
    ],
  ]);
}

// install-host-ca.sh against throwaway certificates.
function makeCert(dir, cn) {
  const key = join(dir, `${cn}.key`);
  const crt = join(dir, `${cn}.crt`);
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'ec',
      '-pkeyopt',
      'ec_paramgen_curve:P-256',
      '-nodes',
      '-keyout',
      key,
      '-out',
      crt,
      '-days',
      '1',
      '-subj',
      `/CN=${cn}`,
    ],
    { stdio: 'ignore' },
  );
  return { key: readFileSync(key, 'utf8'), crt: readFileSync(crt, 'utf8') };
}

const gen = join(tmp, 'gen');
mkdirSync(gen);
const a = makeCert(gen, 'throwaway-a');
const b = makeCert(gen, 'throwaway-b');
const c = makeCert(gen, 'throwaway-c');

function installCase(name, setup, expect) {
  const src = join(tmp, `src-${n}`);
  const dest = join(tmp, `dest-${n}`);
  mkdirSync(dest);
  writeFileSync(join(dest, 'image-own.crt'), a.crt);
  setup(src, dest);
  const r = run('.devcontainer/install-host-ca.sh', [src], { HOST_CA_DEST: dest });
  const files = readdirSync(dest).sort();
  const hostFiles = files.filter((f) => f.startsWith('host-'));
  const updateCalls = r.calls.filter((c) => c.startsWith('update-ca-certificates'));
  const updates = updateCalls.length;
  scenario(name, expect({ r, dest, files, hostFiles, updates, updateCalls }));
}

installCase(
  'install-host-ca.sh is a quiet no-op for a missing directory',
  () => {},
  ({ r, files, updates }) => [
    [r.status === 0, `expected exit 0, got ${r.status}: ${r.stderr}`],
    [r.stderr === '', `expected no stderr, got: ${r.stderr}`],
    [updates === 0, 'update-ca-certificates should not run'],
    [files.join() === 'image-own.crt', `destination should be untouched: ${files}`],
  ],
);

installCase(
  'install-host-ca.sh is a quiet no-op for an empty directory',
  (src) => mkdirSync(src),
  ({ r, files, updates }) => [
    [r.status === 0, `expected exit 0, got ${r.status}: ${r.stderr}`],
    [r.stderr === '', `expected no stderr, got: ${r.stderr}`],
    [updates === 0, 'update-ca-certificates should not run'],
    [files.join() === 'image-own.crt', `destination should be untouched: ${files}`],
  ],
);

installCase(
  'install-host-ca.sh splits bundles, validates each cert, skips keys and junk, replaces stale',
  (src, dest) => {
    mkdirSync(join(src, 'nested'), { recursive: true });
    // A two-cert bundle with Windows line endings, a .pem holding a key and a cert, junk, a non-cert file.
    writeFileSync(join(src, 'bundle.crt'), (a.crt + b.crt).replace(/\n/g, '\r\n'));
    writeFileSync(join(src, 'nested', 'proxy.pem'), c.key + c.crt);
    writeFileSync(
      join(src, 'broken.crt'),
      '-----BEGIN CERTIFICATE-----\nnot base64\n-----END CERTIFICATE-----\n',
    );
    writeFileSync(join(src, 'readme.txt'), a.crt);
    writeFileSync(join(dest, 'host-stale-001.crt'), a.crt);
  },
  ({ r, dest, files, hostFiles, updates }) => {
    const installed = hostFiles.map((f) => readFileSync(join(dest, f), 'utf8'));
    return [
      [r.status === 0, `expected exit 0, got ${r.status}: ${r.stderr}`],
      [
        hostFiles.join() ===
          'host-bundle.crt-001.crt,host-bundle.crt-002.crt,host-nested_proxy.pem-001.crt',
        `unexpected host files: ${hostFiles}`,
      ],
      [!files.includes('host-stale-001.crt'), 'stale host cert should be removed'],
      [files.includes('image-own.crt'), "the image's own certificates must be kept"],
      [
        installed.every((t) => (t.match(/BEGIN CERTIFICATE/g) ?? []).length === 1),
        'one cert per file',
      ],
      [installed.every((t) => !t.includes('\r')), 'carriage returns should be stripped'],
      [installed.every((t) => !t.includes('PRIVATE KEY')), 'private keys must never be copied'],
      [/WARNING.*broken\.crt/.test(r.stderr), `invalid cert should be warned about: ${r.stderr}`],
      [updates === 1, `update-ca-certificates should run once, ran ${updates}`],
    ];
  },
);

installCase(
  'install-host-ca.sh removes stale host certs when the directory is now empty',
  (src, dest) => {
    mkdirSync(src);
    writeFileSync(join(dest, 'host-old-001.crt'), a.crt);
  },
  ({ r, files, updates, updateCalls }) => [
    [r.status === 0, `expected exit 0, got ${r.status}: ${r.stderr}`],
    [files.join() === 'image-own.crt', `stale host cert should be removed: ${files}`],
    [updates === 1, 'update-ca-certificates should run to drop the stale cert'],
    // Without --fresh, Debian leaves the removed cert's links in /etc/ssl/certs.
    [updateCalls[0]?.includes('--fresh') === true, `expected --fresh: ${updateCalls}`],
  ],
);

installCase(
  'install-host-ca.sh refuses to run without a directory argument',
  () => {},
  () => {
    const r = run('.devcontainer/install-host-ca.sh', [], { HOST_CA_DEST: dirname(tmp) });
    return [[r.status !== 0, 'expected non-zero exit without an argument']];
  },
);

rmSync(tmp, { recursive: true, force: true });
if (problems.length > 0) {
  reportError(`ca script check: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`ca script check: ${n} scenarios passed against setup.sh and install-host-ca.sh`);
