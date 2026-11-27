// Starts backend and frontend dev servers together, with prefixed output.
// Zero dependencies on purpose: the repo root has no node_modules.
// Ctrl+C stops both. If either exits, the other is stopped too.
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const apps = [
  { name: 'backend ', dir: 'backend', color: '\x1b[34m' },
  { name: 'frontend', dir: 'frontend', color: '\x1b[32m' },
];

const children = apps.map(({ name, dir, color }) => {
  const child = spawn(npm, ['--prefix', dir, 'run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
    // Own process group, so stopping kills npm *and* the tsx/vite it started.
    // (npm does not reliably forward SIGTERM to its children.)
    detached: !isWindows,
  });
  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`);
    shutdown(code ?? 0);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    try {
      if (isWindows) c.kill('SIGTERM');
      else process.kill(-c.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
