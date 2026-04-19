# @onedarnleyroad/vite-plugin-svg-sprite

A Vite plugin that builds SVG sprite sheets from a directory of SVG files — with content-hashed filenames and full Vite manifest integration.

## Features

- Combines individual SVGs into a single `<svg>` sprite with `<symbol>` elements
- **Content-hashed output** (e.g. `sprite-DAskUDYW.svg`) so browsers never serve stale sprites
- **Vite manifest integration** — works out of the box with [nystudio107's Craft Vite plugin](https://nystudio107.com/docs/vite/) and any other manifest consumer
- **Multiple sprites from subfolders** — organise icons into `light/`, `dark/`, etc. and get one sprite per folder
- Namespaces internal IDs to prevent conflicts across icons
- **Preserves presentation attributes** (`fill`, `stroke`, `stroke-width`, `opacity`, `style`, …) from the outer `<svg>` so `fill="currentColor"` and friends keep working
- Preserves existing `<title>` elements, or falls back to the filename
- Strips comments and empty `<defs>` blocks
- Dev server serves sprites from memory with full-reload on change

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
  build: {
    manifest: true,
  },
  plugins: [
    svgSprite({
      inputDir: 'src/icons',
    }),
  ],
})
```

### Options

| Option      | Type     | Default    | Description                                                                 |
|-------------|----------|------------|-----------------------------------------------------------------------------|
| `inputDir`  | `string` | _required_ | Directory containing the source `.svg` files.                               |
| `outputDir` | `string` | `'assets'` | Output directory, relative to Vite's `build.outDir`.                         |
| `prefix`    | `string` | `'sprite'` | Filename prefix. The dash between prefix and folder name is always added. |

All paths are resolved relative to the project root.

## Subfolders

Organise icons into subfolders to produce one sprite per folder. Loose `.svg` files at the root of `inputDir` go into the default sprite.

```
src/icons/
├── arrow.svg      ─┐
├── close.svg       ├─→ sprite.svg         → dist/assets/sprite-{HASH}.svg
├── menu.svg       ─┘
├── light/
│   ├── sun.svg    ─┐
│   └── star.svg   ─┴─→ sprite-light.svg   → dist/assets/sprite-light-{HASH}.svg
└── dark/
    ├── moon.svg   ─┐
    └── cloud.svg  ─┴─→ sprite-dark.svg    → dist/assets/sprite-dark-{HASH}.svg
```

Only the first level of subfolders is scanned. Empty subfolders are skipped.

## Output symbol IDs

Each SVG becomes a `<symbol>` with `id="svg-{filename}"`. For example, `arrow.svg` becomes:

```html
<symbol id="svg-arrow" viewBox="0 0 24 24">
  <title>arrow icon</title>
  <!-- ... -->
</symbol>
```

## Using the sprite

### With Vite manifest (recommended)

With `build.manifest: true` enabled, each sprite is registered in `manifest.json` keyed by its `inputDir`-relative path:

```json
{
  "src/icons/sprite.svg":       { "file": "assets/sprite-DAskUDYW.svg",       "src": "src/icons/sprite.svg",       "isEntry": false },
  "src/icons/sprite-light.svg": { "file": "assets/sprite-light-xV7q1sYy.svg", "src": "src/icons/sprite-light.svg", "isEntry": false }
}
```

With Craft CMS + [nystudio107/craft-vite](https://nystudio107.com/docs/vite/), use `craft.vite.asset()` — **not `entry()`**. The `asset()` helper is dev-server-aware; `entry()` always reads the manifest, so in dev it would serve stale built files:

```twig
<svg aria-hidden="true">
  <use href="{{ craft.vite.asset('src/icons/sprite.svg') }}#svg-arrow"></use>
</svg>

<svg aria-hidden="true">
  <use href="{{ craft.vite.asset('src/icons/sprite-light.svg') }}#svg-sun"></use>
</svg>
```

In dev, `asset()` returns the Vite dev-server URL (e.g. `https://…:3000/src/icons/sprite.svg`), which the plugin's in-memory middleware serves. In production it returns the hashed URL from the manifest.

### Without manifest

You can reference the sprite directly if you don't use a manifest — but the filename will be hashed, so you'd need to read the hash yourself or disable hashing manually. The manifest-based flow is strongly recommended.

## Migrating from v1

v2 is a breaking change. The API moved from "write a single file to an exact path" to "emit hashed assets that Vite owns".

```js
// v1
svgSprite({
  inputDir: 'src/icons',
  outputFile: 'web/dist/sprite.svg',
})

// v2
svgSprite({
  inputDir: 'src/icons',
  // outputDir defaults to 'assets' (inside Vite's build.outDir)
  // prefix defaults to 'sprite'
})
```

Passing `outputFile` in v2 throws an error. Update your templates to read the sprite URL from Vite's manifest instead of hard-coding the path.

## License

MIT © [One Darnley Road](https://onedarnleyroad.com)
