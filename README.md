# dsh-currency-fix

DeepSeek Harness Web plugin. Stops prices such as `$150–600` in chat replies
from being drawn as LaTeX math.

## Why

The built-in Markdown renderer always treats `$…$` as inline math. A reply with
two prices on one line turns into one italic formula with the words run
together, and bold markers in between break.

## How

The browser half wraps the built-in `assistant-step` renderer in place (the
same slot entry, so reasoning rows, images and file links keep working) and
hands it a copy of the reply with currency dollars escaped as `\$`. The saved
session text is not changed, so old chats are fixed as well.

- Escaped: `$` directly followed by a digit (`$5`, `$1.20/h`, `$150–600`).
- Kept as math: `$x^2$`, `$\alpha$`, `$2^{10}$` (digit-first math with TeX
  markers `\ ^ _ { }`), and `$$…$$`.
- Never touched: fenced code, inline code, existing `\$`.

## Install

```sh
dsh plugin --profile <profile> add github:eliaweiss/dsh-currency-fix
```

Then refresh the page.

## Test

```sh
npm test
```

## License

MIT
