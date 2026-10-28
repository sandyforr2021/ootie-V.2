import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateMigrationSources } from './lib/migrationSources.mjs'

const root = resolve(import.meta.dirname, '..')
const allowedStatuses = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT REQUIRED'])
const errors = []

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const checklist = await readJson('production/production-release-checklist.json')
const migrationManifest = await readJson('production/production-migration-manifest.json')
const secretInventory = await readJson('production/secret-inventory.example.json')

if (checklist.classification !== 'RED' || checklist.launchAuthorized !== false) {
  errors.push('Phase 9 checklist must remain RED and launchAuthorized=false.')
}

for (const item of checklist.items ?? []) {
  if (!allowedStatuses.has(item.status)) errors.push(`Invalid checklist status: ${item.id}`)
  if (!item.id || !item.category) errors.push('Every checklist item needs id and category.')
}

const requiredCategories = [
  'Infrastructure', 'Database', 'Auth', 'Storage', 'AI', 'Email', 'Domain',
  'Security', 'Legal', 'Monitoring', 'Backups', 'Rollback', 'Performance',
  'PWA', 'Payments', 'QA',
]
for (const category of requiredCategories) {
  if (!checklist.items.some((item) => item.category === category)) {
    errors.push(`Missing checklist category: ${category}`)
  }
}

if (migrationManifest.status !== 'BLOCKED') errors.push('Migration manifest must stay BLOCKED until replacements are rehearsed.')
const migrationByRange = new Map(migrationManifest.migrations.map((item) => [item.range, item.action]))
if (migrationByRange.get('020') !== 'REPLACE') errors.push('Migration 020 must be replaced for Production.')
for (const range of ['021', '023']) {
  if (migrationByRange.get(range) !== 'EXCLUDE') errors.push(`Migration ${range} must be excluded from Production.`)
}
if (migrationManifest.rules?.allowDemoSeed !== false) errors.push('Production manifest must forbid Demo seeds.')

if (secretInventory.containsSecretValues !== false) errors.push('Secret inventory must not contain values.')
for (const entry of secretInventory.entries ?? []) {
  for (const key of Object.keys(entry)) {
    if (/^(value|secret|password|token|key)$/i.test(key)) errors.push(`Secret-like value field found on ${entry.name}: ${key}`)
  }
}

const migrationFiles = (await readdir(resolve(root, 'supabase/personal_baseline')))
  .filter((name) => /^\d{3}_.*\.sql$/.test(name))
  .sort()
errors.push(...validateMigrationSources(migrationFiles, migrationManifest))

const productionFiles = [
  'PRODUCTION_ARCHITECTURE.md',
  'PRODUCTION_OPERATIONS.md',
  'PRODUCTION_MIGRATION_REHEARSAL.md',
  'PRODUCTION_RELEASE_CHECKLIST.md',
  'deploy/production/web-service.template.yaml',
  'deploy/production/gateway-service.template.yaml',
]
for (const path of productionFiles) {
  const value = await readFile(resolve(root, path), 'utf8')
  if (/hoxkrmadzjnyjaqjbyxc/.test(value) && path.startsWith('deploy/production/')) {
    errors.push(`Development Supabase ref found in Production deployment template: ${path}`)
  }
  if (/(localhost|127\.0\.0\.1|ootie-web-dev|ootie-ai-gateway-dev)/i.test(value) && path.startsWith('deploy/production/')) {
    errors.push(`Development origin/service found in Production deployment template: ${path}`)
  }
}

if (errors.length) {
  console.error(`Production readiness validation failed (${errors.length}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const summary = checklist.items.reduce((counts, item) => {
  counts[item.status] = (counts[item.status] ?? 0) + 1
  return counts
}, {})
console.log(`Production readiness metadata valid. Overall=${checklist.classification}; PASS=${summary.PASS ?? 0}; FAIL=${summary.FAIL ?? 0}; BLOCKED=${summary.BLOCKED ?? 0}; NOT_REQUIRED=${summary['NOT REQUIRED'] ?? 0}.`)

