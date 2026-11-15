// Starts the mock OData server (apps/mock) on http://localhost:4400.
// Usage: node run.mjs [--reset] [extra args passed to the server]. Env (e.g. E2E=1) is passed through.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const exe = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';

function findDotnet() {
  const candidates = [];
  if (process.env.DOTNET_ROOT) candidates.push(join(process.env.DOTNET_ROOT, exe));
  candidates.push(join(homedir(), '.dotnet', exe));
  for (const c of candidates) if (existsSync(c)) return c;
  const probe = spawnSync(exe, ['--version'], { stdio: 'ignore' });
  if (probe.status === 0) return exe;
  console.error('[mock] .NET SDK not found. Install .NET 10 SDK to ~/.dotnet or set DOTNET_ROOT.');
  process.exit(1);
}

const dotnet = findDotnet();
const env = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' };
if (dotnet !== exe && !env.DOTNET_ROOT) env.DOTNET_ROOT = dirname(dotnet);

// Build once, then run without rebuilding.
const build = spawnSync(dotnet, ['build', dir, '-c', 'Release', '--nologo', '-v', 'q'], { stdio: 'inherit', env });
if (build.status !== 0) process.exit(build.status ?? 1);

const args = ['run', '--project', dir, '-c', 'Release', '--no-build', '--no-launch-profile', '--urls', 'http://localhost:4400', ...process.argv.slice(2)];
const child = spawn(dotnet, args, { stdio: 'inherit', env });

let exiting = false;
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    if (exiting) return;
    exiting = true;
    child.kill(sig);
    // dotnet run forwards the signal to the app; make sure nothing is left behind.
    setTimeout(() => child.kill('SIGKILL'), 5000).unref();
  });
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
