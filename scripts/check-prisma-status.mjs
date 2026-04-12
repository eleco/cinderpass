import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];

  const envPath = path.join(process.cwd(), '.env');
  if (!existsSync(envPath)) return undefined;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }

  return undefined;
}

const databaseUrl = readEnvValue('DATABASE_URL');

if (!databaseUrl) {
  console.log('Skipping Prisma migration check: DATABASE_URL is not set.');
  process.exit(0);
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxCommand, ['prisma', 'migrate', 'status'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

if (result.status === 0) {
  if (output) console.log(output);
  process.exit(0);
}

if (output) console.error(output);

if (output.includes('Following migrations have not yet been applied')) {
  console.error('\nYour database schema is behind this codebase.');
  console.error('Run `npm run db:migrate` and then retry `npm run dev`.');
}

process.exit(result.status ?? 1);
