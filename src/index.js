import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, basename, extname, dirname } from 'path'

export default function svgSpritePlugin({ inputDir, outputFile }) {
    const input = resolve(inputDir)
    const output = resolve(outputFile)

    function build() {
        const symbols = readdirSync(input)
            .filter(f => f.endsWith('.svg'))
            .sort()
            .map(file => {
                const name = basename(file, extname(file))
                const svg = readFileSync(resolve(input, file), 'utf-8')

                // Preserve existing <title> if present, otherwise use filename
                const existingTitle = svg.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
                const title = existingTitle ?? `${name} icon`

                // Strip comments, existing <title> tags, and empty <defs> blocks
                const cleaned = svg
                    .replace(/<!--[\s\S]*?-->/g, '')
                    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
                    .replace(/<defs[^>]*>\s*<\/defs>/gi, '')

                // Namespace internal IDs to avoid conflicts when sprites are merged
                const namespaced = cleaned
                    .replace(/\bid="([^"]+)"/g, `id="${name}-$1"`)
                    .replace(/\burl\(#([^)]+)\)/g, `url(#${name}-$1)`)
                    .replace(/\bhref="#([^"]+)"/g, `href="#${name}-$1"`)
                    .replace(/\bxlink:href="#([^"]+)"/g, `xlink:href="#${name}-$1"`)

                const viewBox = namespaced.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24'

                const inner = namespaced
                    .replace(/<svg[^>]*>/i, '')
                    .replace(/<\/svg>/i, '')
                    .replace(/\s*\n\s*/g, ' ')
                    .replace(/>\s+</g, '><')
                    .trim()

                return `<symbol id="svg-${name}" viewBox="${viewBox}"><title>${title}</title>${inner}</symbol>`
            })

        mkdirSync(dirname(output), { recursive: true })
        writeFileSync(output, `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join('\n')}\n</svg>`)
    }

    return {
        name: 'svg-sprite',
        buildStart() {
            if (this.meta.watchMode) build()
        },
        writeBundle: build,
        handleHotUpdate({ file }) {
            if (file.startsWith(input)) build()
        },
    }
}
