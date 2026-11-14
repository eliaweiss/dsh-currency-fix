import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Load client.js the way the Web UI does: through window.__ModuleLoader__.
let mod
globalThis.window = { __ModuleLoader__: { load: ({ factory }) => { mod = factory(() => ({})) } } }
new Function(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))()
const esc = mod.escapeCurrency

test('the sentence that broke', () => {
  const md = "For violin I'd budget **roughly $150–600 in GPU rental and about 6–10 weeks of full-time work**. Adding flute, viola, cello and guitar costs **another $250–900 and 4–8 weeks**, mostly for gathering data."
  assert.equal(esc(md), md.replace('$150', '\\$150').replace('$250', '\\$250'))
})

test('several prices on one line', () => {
  assert.equal(esc('the hoodie is $45 and the T-shirt is $25, so the pair is $70.'),
    'the hoodie is \\$45 and the T-shirt is \\$25, so the pair is \\$70.')
})

test('real math is kept', () => {
  for (const m of ['$E = mc^2$', '$x^2$', '$\\alpha + \\beta$', '$2^{10}$', '$a_1 + a_2$', 'cost $$x = 5$$ ok']) {
    assert.equal(esc(m), m, m)
  }
})

test('math next to a price', () => {
  assert.equal(esc('area $x^2$ costs $5'), 'area $x^2$ costs \\$5')
})

test('already escaped and no-digit dollars untouched', () => {
  assert.equal(esc('price \\$5 and a lone $ sign'), 'price \\$5 and a lone $ sign')
})

test('code is untouched', () => {
  const md = 'run `echo $1` then pay $5\n```sh\nexport A=$100\n```\nafter $7'
  assert.equal(esc(md), 'run `echo $1` then pay \\$5\n```sh\nexport A=$100\n```\nafter \\$7')
})

test('display math block untouched', () => {
  const md = '$$\nx = $5\n$$\nthen $6'
  assert.equal(esc(md), '$$\nx = $5\n$$\nthen \\$6')
})

test('tables with prices', () => {
  assert.equal(esc('| GPU | $1.20/h | $2.50/h |'), '| GPU | \\$1.20/h | \\$2.50/h |')
})

test('no dollar is a no-op', () => {
  const md = 'plain **text**'
  assert.equal(esc(md), md)
})
