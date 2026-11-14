/* dsh-currency-fix — browser half.
 *
 * Problem: the built-in Markdown renderer treats any `$…$` pair as inline
 * LaTeX (single-dollar math is hard-wired on). A reply such as
 * "roughly $150–600 in GPU … another $250–900" is drawn as one italic formula
 * with the words run together, and the bold markers in between break.
 *
 * Fix: wrap the built-in `assistant-step` renderer in place (same slot entry,
 * so its child slots — reasoning rows, images — keep working) and hand it a
 * copy of the reply where currency dollars are escaped as `\$`. The stored
 * session text is never changed, so old chats are fixed too.
 *
 * What is escaped: a `$` directly followed by a digit, unless the text up to
 * the next `$` on the same line looks like TeX (contains \ ^ _ { }).
 * What is left alone: fenced code, inline code, `$$` display math, `\$`, and
 * math that does not start with a digit (`$x^2$`, `$\alpha$`).
 */
window.__ModuleLoader__.load({
  id: 'dsh-currency-fix',
  factory: (require) => {
    const SLOT = 'conversation.chat.node'
    const KEY = 'assistant-step'
    const ORIGINAL = Symbol.for('dsh-currency-fix.original')
    const WRAPPER = Symbol.for('dsh-currency-fix.wrapper')
    const TEX_HINT = /[\\^_{}]/

    /** Escape currency dollars in one run of plain (non-code) Markdown text. */
    function escapeSegment(text) {
      if (text.indexOf('$') === -1) return text
      let out = ''
      let i = 0
      while (i < text.length) {
        const ch = text[i]
        if (ch === '\\') {
          // Keep any existing escape (including `\$`) as is.
          out += text.slice(i, i + 2)
          i += 2
          continue
        }
        if (ch !== '$') {
          out += ch
          i += 1
          continue
        }
        if (text[i + 1] === '$') {
          // `$$` display math delimiter: leave it.
          out += '$$'
          i += 2
          continue
        }
        const close = findClosing(text, i + 1)
        const next = text[i + 1]
        if (next !== undefined && next >= '0' && next <= '9') {
          const body = close === -1 ? '' : text.slice(i + 1, close)
          if (close !== -1 && TEX_HINT.test(body)) {
            // Real math that starts with a digit, e.g. `$2^{10}$`.
            out += text.slice(i, close + 1)
            i = close + 1
          } else {
            out += '\\$'
            i += 1
          }
          continue
        }
        if (close !== -1 && next !== ' ' && next !== undefined) {
          // Ordinary inline math such as `$x^2$`: copy it whole so its closing
          // `$` is not mistaken for the start of a price.
          out += text.slice(i, close + 1)
          i = close + 1
          continue
        }
        out += ch
        i += 1
      }
      return out
    }

    /** Index of the next unescaped single `$` after `from`, or -1. */
    function findClosing(text, from) {
      for (let j = from; j < text.length; j += 1) {
        const c = text[j]
        if (c === '\\') { j += 1; continue }
        if (c === '$') return text[j + 1] === '$' ? -1 : j
      }
      return -1
    }

    /** Escape outside inline code spans on one line. */
    function escapeLine(line) {
      if (line.indexOf('$') === -1) return line
      if (line.indexOf('`') === -1) return escapeSegment(line)
      let out = ''
      let last = 0
      const code = /(`+)[\s\S]*?\1(?!`)/g
      let m
      while ((m = code.exec(line)) !== null) {
        out += escapeSegment(line.slice(last, m.index)) + m[0]
        last = m.index + m[0].length
      }
      return out + escapeSegment(line.slice(last))
    }

    /** Escape currency dollars in a Markdown document, skipping code and display math. */
    function escapeCurrency(markdown) {
      if (typeof markdown !== 'string' || markdown.indexOf('$') === -1) return markdown
      const lines = markdown.split('\n')
      let fence = null
      let displayMath = false
      for (let n = 0; n < lines.length; n += 1) {
        const line = lines[n]
        const open = /^ {0,3}(`{3,}|~{3,})/.exec(line)
        if (fence !== null) {
          if (open !== null && open[1][0] === fence[0] && open[1].length >= fence.length && line.trim() === open[1]) fence = null
          continue
        }
        if (open !== null) { fence = open[1]; continue }
        if (line.trim() === '$$') { displayMath = !displayMath; continue }
        if (displayMath) continue
        lines[n] = escapeLine(line)
      }
      return lines.join('\n')
    }

    const nodeCache = new WeakMap()

    /** Same node, with currency dollars escaped in its text blocks. */
    function fixNode(node) {
      const blocks = node?.data?.blocks
      if (!Array.isArray(blocks)) return node
      const cached = nodeCache.get(node)
      if (cached !== undefined) return cached
      let changed = false
      const fixed = blocks.map((block) => {
        if (block?.kind !== 'text' || typeof block.text !== 'string') return block
        const text = escapeCurrency(block.text)
        if (text === block.text) return block
        changed = true
        return { ...block, text }
      })
      const result = changed ? { ...node, data: { ...node.data, blocks: fixed } } : node
      nodeCache.set(node, result)
      return result
    }

    function makeWrapper(React, Original) {
      function CurrencyFixAssistant(props) {
        const node = props?.node
        const fixed = node === undefined ? node : fixNode(node)
        return React.createElement(Original, fixed === node ? props : { ...props, node: fixed })
      }
      CurrencyFixAssistant[WRAPPER] = true
      return CurrencyFixAssistant
    }

    function apply(ctx) {
      const React = require('react')
      const patched = new Set()

      const patch = () => {
        for (const entry of ctx.slots.entries(SLOT)) {
          if (entry?.options?.key !== KEY) continue
          const component = entry.component
          if (component === undefined || component[WRAPPER] === true) continue
          entry[ORIGINAL] = component
          entry.component = makeWrapper(React, component)
          patched.add(entry)
        }
      }

      patch()
      const unsubscribe = ctx.slots.subscribe(SLOT, patch)

      ctx.effect(() => () => {
        if (typeof unsubscribe === 'function') unsubscribe()
        for (const entry of patched) {
          if (entry[ORIGINAL] !== undefined) entry.component = entry[ORIGINAL]
          delete entry[ORIGINAL]
        }
        patched.clear()
      }, 'dsh-currency-fix: wrap assistant renderer')
    }

    return { name: 'dsh-currency-fix', inject: ['slots'], apply, escapeCurrency }
  },
})
