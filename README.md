# @onedarnleyroad/vite-plugin-svg-sprite

A Vite plugin that builds an SVG sprite sheet from a directory of SVG files.

## Features

- Combines individual SVGs into a single `<svg>` sprite with `<symbol>` elements
- Namespaces internal IDs to prevent conflicts across icons
- Preserves existing `<title>` elements, or falls back to the filename
- Strips comments and empty `<defs>` blocks
- Rebuilds automatically in watch mode (HMR-aware)

## Installation

```bash
npm install -D @onedarnleyroad/vite-plugin-svg-sprite
```

## Usage

```js
// vite.config.js
import { defineConfig } from 'vite'
import svgSprite from '@onedarnleyroad/vite-plugin-svg-sprite'

export default defineConfig({
  plugins: [
    svgSprite({
      inputDir: 'src/icons',
      outputFile: 'web/dist/sprite.svg',
    }),
  ],
})
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `inputDir` | `string` | Directory containing the source `.svg` files |
| `outputFile` | `string` | Path for the generated sprite sheet |

Both paths are resolved relative to the project root (where `vite.config.js` lives).

## Output

Each SVG becomes a `<symbol>` with an `id` prefixed with `svg-`. For example, `arrow.svg` becomes:

```html
<symbol id="svg-arrow" viewBox="0 0 24 24">
  <title>arrow icon</title>
  <!-- ... -->
</symbol>
```

Use it in your HTML with `<use>`:

```html
<svg aria-hidden="true">
  <use href="/dist/sprite.svg#svg-arrow" />
</svg>
```

## License

MIT © [One Darnley Road](https://onedarnleyroad.com)
