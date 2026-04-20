# @onedarnleyroad/vite-plugin-svg-sprite

A Vite plugin that builds SVG sprite sheets from a directory of SVG files — with content-hashed filenames and full Vite manifest integration.

## Features

- Combines individual SVGs into a single `<svg>` sprite with `<symbol>` elements
- **Content-hashed output** (e.g. `sprite-DAskUDYW.svg`) so browsers never serve stale sprites
- **Vite manifest integration** — works out of the box with [nystudio107's Craft Vite plugin](https://nystudio107.com/docs/vite/) and any other manifest consumer
- **Multiple sprites from subfolders** — organise icons into `light/`, `dark/`, etc. and get one sprite per folder
- Namespaces internal IDs to prevent conflicts across icons
- **Preserves outer `<svg>` attributes** on the generated `<symbol>` — `fill="currentColor"`, `stroke`, `class`, `role`, `aria-*`, `data-*`, `style` (including CSS custom properties), etc. Only the truly wrapper-specific attributes are stripped: `xmlns`, `version`, `width`, `height`, and `id` (we set our own).
- Preserves existing `<title>` elements, or falls back to the filename
- Strips comments and empty `<defs>` blocks

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

`inputDir` is resolved relative to the project root; `outputDir` is resolved relative to Vite's `build.outDir`.

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

With `build.manifest: true` enabled, each sprite is registered in `manifest.json` under a purely logical key — the root sprite is `{prefix}.svg`, and each subfolder sprite is `{folder}/{prefix}.svg`:

```json
{
  "sprite.svg":       { "file": "assets/sprite-DAskUDYW.svg",       "src": "sprite.svg",       "isEntry": false },
  "light/sprite.svg": { "file": "assets/sprite-light-xV7q1sYy.svg", "src": "light/sprite.svg", "isEntry": false }
}
```

These keys don't correspond to real files on disk — they're the handle you pass to your manifest consumer.

With Craft CMS + [nystudio107/craft-vite](https://nystudio107.com/docs/vite/):

```twig
<svg aria-hidden="true">
  <use href="{{ craft.vite.entry('sprite.svg') }}#svg-arrow"></use>
</svg>

<svg aria-hidden="true">
  <use href="{{ craft.vite.entry('light/sprite.svg') }}#svg-sun"></use>
</svg>
```

`entry()` resolves the hashed URL from the manifest.

## Development workflow

Sprites are generated at build time only — the plugin does **not** run during `vite dev`. For a live-ish dev loop, run a separate build watcher alongside your usual dev server:

```bash
vite build --watch
```

Every edit under `inputDir` triggers a rebuild (a second or two), updates `manifest.json` with the new content hash, and `craft.vite.entry('sprite.svg')` picks up the new URL on the next request. Not instant HMR, but avoids the CORS / cross-origin complications of trying to serve sprites through a separate dev port.

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
