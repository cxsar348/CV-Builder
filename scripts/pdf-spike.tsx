import { mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

type SpikeLine = {
  kind: 'name' | 'contact' | 'heading' | 'body' | 'entry' | 'bullet'
  text: string
}

type SpikeFixture = {
  id: string
  lines: SpikeLine[]
  orderedExcerpts: string[]
  accentExcerpt?: string
}

const fixtures: SpikeFixture[] = [
  {
    id: 'english',
    lines: [
      { kind: 'name', text: 'Alex Morgan' },
      { kind: 'contact', text: 'alex.morgan@example.test | +1 555 0100 | Austin, TX' },
      { kind: 'heading', text: 'Professional Summary' },
      { kind: 'body', text: 'Product analyst focused on clear, measurable outcomes.' },
      { kind: 'heading', text: 'Work Experience' },
      { kind: 'entry', text: 'Product Analyst | Sample Labs | January 2022 – Present' },
      { kind: 'bullet', text: 'Reduced analysis time by 35% with Python and SQL.' },
      { kind: 'heading', text: 'Education' },
      { kind: 'entry', text: 'B.S. Information Systems | Example University | May 2021' },
    ],
    orderedExcerpts: ['Alex Morgan', 'Professional Summary', 'Work Experience', 'January 2022', 'Reduced analysis time', 'Education'],
  },
  {
    id: 'spanish',
    lines: [
      { kind: 'name', text: 'Lucía Peña García' },
      { kind: 'contact', text: 'lucia.pena@example.test | +34 600 010 020 | Madrid, España' },
      { kind: 'heading', text: 'Resumen Profesional' },
      { kind: 'body', text: 'Analista de datos con experiencia en gestión y mejora de procesos.' },
      { kind: 'heading', text: 'Experiencia Laboral' },
      { kind: 'entry', text: 'Analista de datos | Ejemplo S. A. | marzo 2022 – presente' },
      { kind: 'bullet', text: 'Diseñé métricas de calidad y reduje errores en 28%.' },
      { kind: 'heading', text: 'Educación' },
      { kind: 'entry', text: 'Licenciatura en Estadística | Universidad Ejemplo | mayo 2021' },
    ],
    orderedExcerpts: ['Lucía Peña García', 'Resumen Profesional', 'Experiencia Laboral', 'marzo 2022', 'Diseñé métricas', 'Educación'],
    accentExcerpt: 'España',
  },
  {
    id: 'long',
    lines: [
      { kind: 'name', text: 'Morgan Example' },
      { kind: 'contact', text: 'morgan@example.test | Portland, OR' },
      { kind: 'heading', text: 'Professional Summary' },
      { kind: 'body', text: 'Experienced program lead with a focus on durable, measurable improvements.' },
      { kind: 'heading', text: 'Work Experience' },
      { kind: 'entry', text: 'Program Lead | Northstar Example | February 2018 – Present' },
      ...Array.from({ length: 42 }, (_, index) => ({
        kind: 'bullet' as const,
        text: `Improved counterintuitiveinternationalization workflow ${index + 1} by 25% using careful planning and clear team communication.`,
      })),
    ],
    orderedExcerpts: ['Morgan Example', 'Professional Summary', 'Work Experience', 'February 2018', 'counterintuitiveinternationalization workflow 1', 'counterintuitiveinternationalization workflow 42'],
  },
]

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 54,
    color: '#111111',
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.25,
  },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 19, marginBottom: 4 },
  contact: { fontSize: 9.5, marginBottom: 12 },
  heading: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 8, marginBottom: 3 },
  body: { marginBottom: 4 },
  entry: { fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  bullet: { marginLeft: 12, marginBottom: 2 },
})

Font.registerHyphenationCallback((word) => [word])

function makeDocument(fixture: SpikeFixture) {
  return createElement(
    Document,
    { title: `Phase 0 extraction fixture: ${fixture.id}`, author: 'CV Builder test fixture' },
    createElement(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      fixture.lines.map((line, index) => {
        if (line.kind === 'bullet') {
          return createElement(
            View,
            { key: `${index}-${line.kind}`, style: styles.bullet, wrap: false },
            createElement(Text, null, `• ${line.text}`),
          )
        }

        return createElement(Text, {
          key: `${index}-${line.kind}`,
          style: styles[line.kind],
          children: line.text,
          wrap: true,
        })
      }),
    ),
  )
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, ' ').trim()
}

async function extractWithPdfJs(data: Uint8Array) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl: `${fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url))}/`,
  })
  const pdf = await loadingTask.promise
  const pageTexts: string[] = []
  const imageOperationNames = [
    'paintImageXObject',
    'paintInlineImageXObject',
    'paintImageMaskXObject',
    'paintImageXObjectRepeat',
  ]
  const ops = (pdfjsLib as unknown as { OPS: Record<string, number> }).OPS
  const imageOperationCodes = new Set(imageOperationNames.map((name) => ops[name]).filter((code) => code !== undefined))

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const text = await page.getTextContent()
    const operatorList = await page.getOperatorList()
    const hasImageOperator = operatorList.fnArray.some((operator) => imageOperationCodes.has(operator))
    if (hasImageOperator) {
      throw new Error(`PDF.js found an image-painting operator on page ${pageNumber}`)
    }
    pageTexts.push(text.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }

  return { text: pageTexts.join('\n'), pageCount: pdf.numPages }
}

function extractWithPoppler(filePath: string) {
  const result = spawnSync('pdftotext', ['-enc', 'UTF-8', '-layout', filePath, '-'], { encoding: 'utf8' })
  if (result.error) {
    throw new Error(`Could not run pdftotext: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`pdftotext failed: ${result.stderr || `exit ${result.status}`}`)
  }
  return result.stdout
}

function assertFixtureText(fixture: SpikeFixture, extracted: string, extractor: string) {
  const normalized = normalizeWhitespace(extracted)
  let previousIndex = -1

  for (const excerpt of fixture.orderedExcerpts) {
    const index = normalized.indexOf(excerpt)
    if (index < 0) {
      throw new Error(`${extractor} could not find “${excerpt}” in ${fixture.id} fixture`)
    }
    if (index <= previousIndex) {
      throw new Error(`${extractor} found CV text out of order in ${fixture.id} fixture at “${excerpt}”`)
    }
    previousIndex = index
  }

  if (!normalized.includes('•')) {
    throw new Error(`${extractor} did not preserve the standard bullet glyph in ${fixture.id} fixture`)
  }
  if (!normalized.includes('–')) {
    throw new Error(`${extractor} did not preserve the en dash in ${fixture.id} fixture`)
  }
  if (fixture.accentExcerpt && !normalized.includes(fixture.accentExcerpt)) {
    throw new Error(`${extractor} did not preserve Spanish accents in ${fixture.id} fixture`)
  }
  if (normalized.includes('\u00ad')) {
    throw new Error(`${extractor} found a soft hyphen in ${fixture.id} fixture`)
  }
}

export async function runPdfSpike() {
  const outputDirectory = join(process.cwd(), '.tmp', 'pdf-spike')
  await mkdir(outputDirectory, { recursive: true })
  const reports: Array<{ fixture: string; pageCount: number; bytes: number }> = []

  for (const fixture of fixtures) {
    const pdfBytes = await renderToBuffer(makeDocument(fixture))
    const pdfPath = join(outputDirectory, `${fixture.id}.pdf`)
    await writeFile(pdfPath, pdfBytes)

    const rawPdf = Buffer.from(pdfBytes).toString('latin1')
    if (rawPdf.includes('/Subtype /Image')) {
      throw new Error(`PDF contains an image XObject in ${fixture.id} fixture`)
    }

    const pdfJsResult = await extractWithPdfJs(pdfBytes)
    const popplerText = extractWithPoppler(pdfPath)
    assertFixtureText(fixture, pdfJsResult.text, 'PDF.js')
    assertFixtureText(fixture, popplerText, 'Poppler')

    if (!normalizeWhitespace(pdfJsResult.text).includes('counterintuitiveinternationalization') && fixture.id === 'long') {
      throw new Error('PDF.js split the long word during layout or extraction')
    }

    reports.push({ fixture: fixture.id, pageCount: pdfJsResult.pageCount, bytes: pdfBytes.byteLength })
  }

  return reports
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runPdfSpike()
    .then((reports) => {
      for (const report of reports) {
        process.stdout.write(`PASS ${report.fixture}: ${report.pageCount} page(s), ${report.bytes} bytes\n`)
      }
      process.stdout.write('PASS PDF.js and Poppler text extraction, reading order, accents, bullets, en dash, hyphenation, and text-only output\n')
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
      process.exitCode = 1
    })
}
