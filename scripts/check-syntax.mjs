import { readdir } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const canonicalRoot = new URL('../', import.meta.url);
const sourceRoot = new URL('../src/', import.meta.url);
const scriptRoot = new URL('../scripts/', import.meta.url);

async function collect(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl);
    if (entry.isDirectory()) files.push(...await collect(child));
    else if (['.js', '.mjs'].includes(extname(entry.name))) files.push(child);
  }
  return files;
}

const files = [...await collect(sourceRoot), ...await collect(scriptRoot)];
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    const diagnostics = [result.stderr, result.stdout, result.error?.message]
      .filter((message) => typeof message === 'string' && message.trim())
      .map((message) => message.trim());
    failures.push({
      file: relative(fileURLToPath(canonicalRoot), fileURLToPath(file)),
      message: diagnostics[0] ?? 'Syntax check failed without diagnostics.'
    });
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`${failure.file}: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed: ${files.length} canonical JS/MJS files.`);
}
