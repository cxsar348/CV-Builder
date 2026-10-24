import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url))
const destination = `${root}public/pdfjs-standard-fonts`

await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
await cp(source, destination, { recursive: true })
