import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = mkdtempSync(join(tmpdir(), 'slovo-vocabulary-'))
try {
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}\n')
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'), resolve(root, 'src/words.ts'),
    '--outDir', output, '--module', 'commonjs', '--moduleResolution', 'node',
    '--target', 'ES2022', '--skipLibCheck',
  ], { cwd: root, stdio: 'pipe' })
  const require = createRequire(join(output, 'check.cjs'))
  const { words, categories, matchesLevel } = require('./words.js')
  const ids = new Set()
  const terms = new Set()
  const normalise = value => value.normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('uk')
  assert(words.length > 0, 'The vocabulary must not be empty')
  for (const word of words) {
    for (const field of ['id', 'uk', 'pronunciation', 'zh', 'part', 'example', 'translation']) {
      assert(typeof word[field] === 'string' && word[field].trim(), `${word.id}: missing ${field}`)
    }
    assert(!ids.has(word.id), `Duplicate ID: ${word.id}`)
    assert(!terms.has(normalise(word.uk)), `Duplicate Ukrainian term: ${word.uk}`)
    ids.add(word.id)
    terms.add(normalise(word.uk))
    assert(categories.some(category => category.id === word.category), `${word.id}: unknown category`)
    assert(['A1', 'A2', 'B1', '行业'].includes(word.level), `${word.id}: unknown level`)
    assert(!/[ыэъё]/i.test(word.uk), `${word.id}: check Ukrainian spelling`)
    assert(/[а-яіїєґ]/i.test(word.uk) && /[а-яіїєґ]/i.test(word.example), `${word.id}: Ukrainian text is required`)
    assert(/[\u3400-\u9fff]/u.test(word.zh) && /[\u3400-\u9fff]/u.test(word.translation), `${word.id}: Chinese text is required`)
    assert.equal(['energy', 'storage'].includes(word.category), word.level === '行业', `${word.id}: industry category and level must agree`)
    for (const field of ['abbreviation', 'note']) {
      if (word[field] !== undefined) assert(word[field].trim(), `${word.id}: empty optional ${field}`)
    }
  }
  const levels = Object.fromEntries(['A1', 'A2', 'B1', '行业'].map(level => [level, words.filter(word => word.level === level).length]))
  const topics = Object.fromEntries(['energy', 'storage'].map(category => [category, words.filter(word => word.category === category).length]))
  console.log(`Vocabulary valid: ${words.length} cards; ${words.filter(word => matchesLevel(word, 'recommended')).length} in the default deck.`)
  console.log('Levels:', JSON.stringify(levels), 'Industry topics:', JSON.stringify(topics))
} finally {
  rmSync(output, { recursive: true, force: true })
}
