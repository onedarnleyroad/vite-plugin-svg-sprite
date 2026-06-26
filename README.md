# @onedarnleyroad/vite-plugin-svg-sprite

[![npm (beta)](https://img.shields.io/npm/v/@onedarnleyroad/vite-plugin-svg-sprite/beta?label=npm)](https://www.npmjs.com/package/@onedarnleyroad/vite-plugin-svg-sprite)
[![license](https://img.shields.io/npm/l/@onedarnleyroad/vite-plugin-svg-sprite)](./LICENSE)

A Vite plugin that builds **content-hashed SVG sprite sheets** at build time and registers them in **Vite's manifest** — built for server-rendered apps like **Craft CMS** (via [nystudio107's Vite plugin](https://nystudio107.com/docs/vite/)), and works with any manifest consumer. Organise icons into folders to get one sprite per folder, and reference them from templates with no JavaScript.

## Features

- Combines individual SVGs into a single `<svg>` sprite with `<symbol>` elements
- **Content-hashed output** (e.g. `sprite-9a3f2c1e.svg`) so browsers never serve stale sprites
- **Vite manifest integration** — works out of the box with [nystudio107's Craft Vite plugin](https://nystudio107.com/docs/vite/) and any other manifest consumer
- **Multiple sprites from subfolders** — organise icons into `light/`, `dark/`, etc. and get one sprite per folder
- Namespaces internal IDs to prevent conflicts across icons
- **Preserves outer `<svg>` attributes** on the generated `<symbol>` — `fill="currentColor"`, `stroke`, `class`, `role`, `aria-*`, `data-*`, `style` (including CSS custom properties), etc. Only the truly wrapper-specific attributes are stripped: `xmlns` (and `xmlns:*` namespace declarations such as `xmlns:xlink`), `version`, `width`, `height`, and `id` (we set our own).
- Preserves an existing `<title>`, or synthesizes one from the filename (`arrow.svg` → `arrow icon`)
- Strips comments, XML prolog / DOCTYPE declarations, and empty `<defs>` blocks

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
  <path d="…"/>
</symbol>
```

## Using the sprite

### With Vite manifest (recommended)

With `build.manifest: true` enabled, each sprite is registered in `manifest.json` under a purely logical key — the root sprite is `{prefix}.svg`, and each subfolder sprite is `{prefix}-{folder}.svg`:

```json
{
  "sprite.svg":       { "file": "assets/sprite-9a3f2c1e.svg",       "src": "sprite.svg",       "isEntry": false },
  "sprite-light.svg": { "file": "assets/sprite-light-4b8d70e5.svg", "src": "sprite-light.svg", "isEntry": false }
}
```

These keys don't correspond to real files on disk — they're the handle you pass to your manifest consumer.

With Craft CMS + [nystudio107/craft-vite](https://nystudio107.com/docs/vite/):

```twig
<svg aria-hidden="true">
  <use href="{{ craft.vite.entry('sprite.svg') }}#svg-arrow"></use>
</svg>

<svg aria-hidden="true">
  <use href="{{ craft.vite.entry('sprite-light.svg') }}#svg-sun"></use>
</svg>
```

`entry()` resolves the hashed URL from the manifest.

#### A reusable, accessible macro

Rather than hand-writing the `<svg><use>` wrapper each time, wrap it in a Twig macro. Pass `folder:` for a subfolder sprite — it maps to the `sprite-{folder}.svg` manifest key for you, so templates keep the folder mental model. Icons default to decorative (`aria-hidden="true"`), and switch to a labelled `role="img"` when the icon carries meaning on its own:

```twig
{% macro icon(name, folder = null, label = null, prefix = 'sprite', class = 'icon', extra = {}) %}
  {% set key  = folder ? "#{prefix}-#{folder}.svg" : "#{prefix}.svg" %}
  {% set a11y = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': 'true', focusable: 'false' } %}
  <svg{{ attr({ class: class }|merge(a11y)|merge(extra)) }}>
    <use href="{{ craft.vite.entry(key) }}#svg-{{ name }}"></use>
  </svg>
{% endmacro %}
```

```twig
{{ icon('arrow') }}                                   {# root sprite → entry('sprite.svg') #}
{{ icon('sun', folder: 'light') }}                    {# subfolder → entry('sprite-light.svg') #}
{{ icon('search', label: 'Search') }}                 {# meaningful → role="img" + aria-label #}
<button aria-label="Close">{{ icon('x') }}</button>   {# icon-only control: label the button #}
```

Reach for `aria-hidden="true"` only when the icon is decorative — i.e. sitting next to visible text. A standalone, meaning-bearing icon needs an accessible name (via `label`, or on the enclosing control such as a button), or it's invisible to assistive tech. (`attr()` is Craft's built-in attribute renderer.)

## Development workflow

Sprites are generated at build time only — the plugin does **not** run during `vite dev`. For a live-ish dev loop, run a separate build watcher alongside your usual dev server:

```bash
vite build --watch
```

Every edit under `inputDir` triggers a rebuild (a second or two), updates `manifest.json` with the new content hash, and `craft.vite.entry('sprite.svg')` picks up the new URL on the next request. Not instant HMR, but avoids the CORS / cross-origin complications of trying to serve sprites through a separate dev port.

### Without manifest

You can reference a sprite file directly without a manifest, but its filename is always content-hashed — there's no option to turn hashing off — so you'd have to discover the emitted name yourself (e.g. by globbing `assets/sprite-*.svg`). The manifest-based flow is strongly recommended.

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

## How this differs from other SVG sprite plugins

Several Vite plugins generate SVG sprites; they mostly split by *how the sprite reaches the page*:

- **Runtime injection** (e.g. [`vite-plugin-svg-icons`](https://github.com/vbenjs/vite-plugin-svg-icons)) injects the sprite into the DOM via a virtual import. Great for SPAs; needs JavaScript to run.
- **Import-based** plugins expose each icon as a JS module or framework component. Great when your icons live in JS/JSX.
- **This plugin is build-time and manifest-driven.** It emits content-hashed `.svg` files and registers them in Vite's manifest under stable logical keys, so a **server-rendered** template (Craft/Twig, Laravel/Blade, etc.) resolves the hashed URL with no JavaScript — e.g. `craft.vite.entry('sprite.svg')`. It also emits one sprite per subfolder.

If you want runtime/HMR injection or a virtual import, one of the others will suit you better. If you render HTML on the server and resolve assets through a Vite manifest, this is built for that.

## FAQ

**Does it work with Craft CMS?** Yes — it's the primary target. With [nystudio107's Craft Vite plugin](https://nystudio107.com/docs/vite/), reference a sprite with `craft.vite.entry('sprite.svg')` (see [Using the sprite](#using-the-sprite)).

**How do I reference an icon in a Twig template?** Use `<use href="{{ craft.vite.entry('sprite.svg') }}#svg-{name}">`, or the reusable [`icon()` macro](#a-reusable-accessible-macro).

**Can I have more than one sprite?** Yes — each subfolder of `inputDir` becomes its own sprite, keyed `sprite-{folder}.svg`. See [Subfolders](#subfolders).

**Does it run during `vite dev` / support HMR?** No — it's build-only. Run `vite build --watch` alongside your dev server for a live-ish loop.

**Does it optimise SVGs (SVGO)?** No. It strips editor cruft (XML prolog, comments, empty `<defs>`) and collapses whitespace, but doesn't touch path data — it's intentionally zero-dependency. Run SVGO on your source files if you want optimisation (and set `removeViewBox: false`, since the symbols rely on `viewBox`).

**Why are the manifest keys `sprite.svg` and `sprite-light.svg`, not paths?** Because nystudio107's `entry()` resolves keys with a substring match, and a path-style `light/sprite.svg` would collide with the root `sprite.svg`. Basename keys avoid that.

## License

MIT © [One Darnley Road](https://onedarnleyroad.com)
