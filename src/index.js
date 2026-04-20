import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, basename, extname, join } from 'path'
import { createHash } from 'crypto'

function hashContent(content) {
    return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

const STRIP_ATTRS = new Set(['xmlns', 'version', 'width', 'height', 'id'])

function extractOuterAttrs(openTag) {
    const attrRe = /\s+([a-zA-Z_][a-zA-Z0-9_:-]*)="([^"]*)"/g
    const kept = []
    let m
    while ((m = attrRe.exec(openTag)) !== null) {
        const [, attr, value] = m
        if (STRIP_ATTRS.has(attr) || attr.startsWith('xmlns:')) continue
        kept.push(`${attr}="${value}"`)
    }
    return kept.join(' ')
}

function buildSymbol(svg, name) {
    const existingTitle = svg.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
    const title = existingTitle ?? `${name} icon`

    const cleaned = svg
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<defs[^>]*>\s*<\/defs>/gi, '')

    const namespaced = cleaned
        .replace(/\bid="([^"]+)"/g, `id="${name}-$1"`)
        .replace(/\burl\(#([^)]+)\)/g, `url(#${name}-$1)`)
        .replace(/\bhref="#([^"]+)"/g, `href="#${name}-$1"`)
        .replace(/\bxlink:href="#([^"]+)"/g, `xlink:href="#${name}-$1"`)

    const openTag = namespaced.match(/<svg\b[^>]*>/i)?.[0] ?? ''
    const outerAttrs = extractOuterAttrs(openTag)

    const inner = namespaced
        .replace(/<svg[^>]*>/i, '')
        .replace(/<\/svg>/i, '')
        .replace(/\s*\n\s*/g, ' ')
        .replace(/>\s+</g, '><')
        .trim()

    const attrs = `id="svg-${name}"${outerAttrs ? ' ' + outerAttrs : ''}`
    return `<symbol ${attrs}><title>${title}</title>${inner}</symbol>`
}

function buildSpriteSvg(dir, files) {
    const symbols = files.sort().map(file => {
        const name = basename(file, extname(file))
        const svg = readFileSync(join(dir, file), 'utf-8')
        return buildSymbol(svg, name)
    })
    return `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join('\n')}\n</svg>`
}

function collectSpriteGroups(inputDir, prefix) {
    const absInput = resolve(inputDir)
    const entries = readdirSync(absInput, { withFileTypes: true })

    const groups = []

    const rootFiles = entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.svg'))
        .map(e => e.name)
    if (rootFiles.length > 0) {
        groups.push({ logicalName: `${prefix}.svg`, dir: absInput, files: rootFiles })
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const subDir = join(absInput, entry.name)
        const subFiles = readdirSync(subDir, { withFileTypes: true })
            .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.svg'))
            .map(e => e.name)
        if (subFiles.length === 0) continue
        groups.push({ logicalName: `${prefix}-${entry.name}.svg`, dir: subDir, files: subFiles })
    }

    return groups
}

export default function svgSpritePlugin(options = {}) {
    if ('outputFile' in options) {
        throw new Error(
            '[vite-plugin-svg-sprite] `outputFile` was removed in v2. Use `outputDir` (relative to Vite\'s build.outDir) and `prefix` instead. See README for migration.'
        )
    }

    const { inputDir, outputDir = 'assets', prefix = 'sprite' } = options

    if (!inputDir) {
        throw new Error('[vite-plugin-svg-sprite] `inputDir` is required.')
    }

    const absInputDir = resolve(inputDir)
    const emitted = []
    let viteConfig

    return {
        name: 'svg-sprite',

        configResolved(config) {
            viteConfig = config
        },

        generateBundle() {
            emitted.length = 0
            for (const group of collectSpriteGroups(inputDir, prefix)) {
                const source = buildSpriteSvg(group.dir, group.files)
                const base = group.logicalName.replace(/\.svg$/, '')
                const hashedFileName = join(outputDir, `${base}-${hashContent(source)}.svg`)
                const key = join(inputDir, group.logicalName)
                this.emitFile({ type: 'asset', fileName: hashedFileName, source })
                emitted.push({ key, fileName: hashedFileName })
            }
        },

        writeBundle(outputOptions) {
            if (!viteConfig?.build?.manifest) return

            const manifestName = typeof viteConfig.build.manifest === 'string'
                ? viteConfig.build.manifest
                : '.vite/manifest.json'
            const manifestPath = resolve(outputOptions.dir, manifestName)
            if (!existsSync(manifestPath)) return

            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

            for (const { key, fileName } of emitted) {
                manifest[key] = {
                    file: fileName,
                    src: key,
                    isEntry: false,
                }
            }

            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
        },

        configureServer(server) {
            const sprites = new Map()

            const rebuild = () => {
                sprites.clear()
                for (const group of collectSpriteGroups(inputDir, prefix)) {
                    const key = join(inputDir, group.logicalName)
                    sprites.set(key, buildSpriteSvg(group.dir, group.files))
                }
            }
            rebuild()

            server.middlewares.use((req, res, next) => {
                const path = req.url?.split('?')[0]?.replace(/^\//, '')
                if (!path) return next()
                const match = sprites.get(path)
                if (!match) return next()
                res.setHeader('Content-Type', 'image/svg+xml')
                res.setHeader('Cache-Control', 'no-cache')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
                res.end(match)
            })

            server.watcher.add(absInputDir)
            const onChange = file => {
                if (!file.startsWith(absInputDir)) return
                rebuild()
                server.ws.send({ type: 'full-reload' })
            }
            server.watcher.on('change', onChange)
            server.watcher.on('add', onChange)
            server.watcher.on('unlink', onChange)
        },
    }
}
