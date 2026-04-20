# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@onedarnleyroad/vite-plugin-svg-sprite` is a Vite plugin that builds one or more SVG sprite sheets from a directory of `.svg` files. Sprites are emitted with content-hashed filenames and registered in Vite's build manifest under a purely logical key — `{prefix}.svg` for the root sprite, `{folder}/{prefix}.svg` for each subfolder sprite. These keys are the handle downstream tools like nystudio107's Craft Vite plugin look up via `craft.vite.entry('sprite.svg')`; they don't correspond to any real file on disk.

The entire plugin is implemented in [src/index.js](src/index.js). Zero dependencies beyond Node built-ins (`fs`, `path`, `crypto`).

## Package

- ESM-only (`"type": "module"`)
- No `scripts`, no build step, no test suite, no linter
- Single export: `"." → "./src/index.js"`
- Peer dependency: Vite ≥ 4.0.0
- Current major: **v2** (breaking change from v1 — see README migration note). Check `package.json` for the exact version; v2 is currently shipping as beta tags on npm.

## API

```js
svgSpritePlugin({
  inputDir,              // required
  outputDir = 'assets',  // relative to Vite's build.outDir
  prefix    = 'sprite',  // filename prefix; dash-separator is mandatory
})
```

Passing `outputFile` (the v1 option) throws a migration error.

## Architecture

### Sprite groups

`collectSpriteGroups(inputDir, prefix)` scans `inputDir` one level deep:

Each group has two separate identifiers:

- `key` — the logical manifest handle: `{prefix}.svg` for the root group, `{folder}/{prefix}.svg` for each subfolder group.
- `fileBase` — the on-disk basename prefix: `{prefix}` for root, `{prefix}-{folder}` for subfolders. Hashing and `outputDir` are applied to this, so all emitted files land flat under `assets/`.

Rules:

- Loose `.svg` files at `inputDir` root → one group.
- Each immediate subfolder containing `.svg` files → one group.
- Empty subfolders are skipped; recursion does **not** go past one level.

### Build pipeline (`generateBundle` + `writeBundle`)

1. For each group, `buildSpriteSvg` produces the full `<svg>…</svg>` string.
2. A short content hash (`sha256 → hex → 8 chars`) is computed ourselves — we can't rely on Vite's auto-hashing via `name:` because Vite's `assetFileNames` pattern discards any directory we put there, so we use `fileName:` instead and own the path + hash.
3. `this.emitFile({ type: 'asset', fileName: '{outputDir}/{fileBase}-{hash}.svg', source })` writes the asset at the exact path we chose.
4. In `writeBundle`, if `build.manifest` is truthy, we read the manifest Vite just wrote (`.vite/manifest.json` or the custom path from `build.manifest` when it's a string), merge our entries keyed by logical `key`, and write it back. Vite's built-in manifest plugin does **not** include emitted assets unless they're imported by a chunk, so this post-hoc merge is necessary.

### Dev mode

The plugin is **build-only** — no `configureServer`, no dev middleware. For a live-ish dev loop users run `vite build --watch` alongside their normal dev server. A previous version tried to serve sprites via an in-memory dev middleware, but cross-origin constraints (CORS + CORP) in setups like DDEV + Craft made it unreliable; a plain `--watch` loop is simpler and works everywhere.

### Symbol generation — the subtle part

`buildSymbol` is the heart of the per-icon transform. Each icon:

- Keeps an existing `<title>` if present, else synthesizes `"{name} icon"`.
- Has comments, existing `<title>` tags, and empty `<defs>` stripped.
- Has **all internal IDs namespaced with `{name}-`**, and every `url(#…)`, `href="#…"`, and `xlink:href="#…"` rewritten to match. This is what prevents collisions when many icons are inlined into one sprite.
- Emits `<symbol id="svg-{name}" viewBox="…"><title>…</title>{inner}</symbol>`.

If you touch this logic, the ID-namespacing and its matching reference rewrites must stay in lockstep.
