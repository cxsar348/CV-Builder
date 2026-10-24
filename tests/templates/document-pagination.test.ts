import { describe, expect, it } from 'vitest'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createEmptyResume, createEntry, createSampleResume } from '../../src/data/model'
import { createResumePdf } from '../../src/pdf/generate'
import { getTemplateOrder, templates } from '../../src/templates/registry'

function makeShortResume() {
  const resume = createEmptyResume('en')
  resume.basics.name = 'Alex Morgan'
  resume.basics.headline = 'Product Analyst'
  resume.basics.email = 'alex.morgan@example.com'
  resume.meta.activeSections = []
  return resume
}

function makeLongResume() {
  const resume = createSampleResume('en')
  const longBullet = 'Improved a cross-functional reporting workflow by 25% through careful analysis, clear documentation, stakeholder coordination, and repeatable quality checks across multiple teams.'
  resume.work = Array.from({ length: 7 }, (_, index) => ({
    ...createEntry(),
    title: `Program Analyst ${index + 1}`,
    organization: `Example Organization ${index + 1}`,
    location: 'Austin, Texas',
    startDate: `20${10 + index}-01`,
    endDate: `20${11 + index}-12`,
    bullets: Array.from({ length: 6 }, (_, bulletIndex) => `${longBullet} Example ${index + 1}.${bulletIndex + 1}.`),
  }))
  resume.meta.activeSections = ['summary', 'skills', 'work', 'education', 'projects', 'languages']
  return resume
}

async function readPdf(blob: Blob) {
  const task = pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true })
  const document = await task.promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  await task.destroy()
  return pages
}

describe('resume document layouts and pagination', () => {
  it.each(templates.map((template) => template.id))('%s lays out short, typical, and long CVs without losing page text', async (templateId) => {
    const short = makeShortResume()
    const typical = createSampleResume('en')
    const long = makeLongResume()
    const resumes = [short, typical, long]
    const pageCounts: number[] = []

    for (const resume of resumes) {
      resume.meta.templateId = templateId
      resume.meta.sectionOrder = getTemplateOrder(templateId)
      const pages = await readPdf(await createResumePdf(resume))
      pageCounts.push(pages.length)
      expect(pages.length).toBeGreaterThan(0)
      expect(pages.every((page) => page.trim().length > 0)).toBe(true)
      expect(pages.join('\n')).toContain(resume.basics.name)
      if (resume === typical) {
        const text = pages.join('\n').toLocaleUpperCase()
        const expectedFirstSection = templateId === 'technical-ats' ? 'SKILLS' : 'PROFESSIONAL SUMMARY'
        expect(text.indexOf(expectedFirstSection)).toBeGreaterThanOrEqual(0)
        if (templateId === 'technical-ats') expect(text.indexOf('SKILLS')).toBeLessThan(text.indexOf('WORK EXPERIENCE'))
      }
      if (resume === long) expect(pages.join('\n')).toContain('Example 7.6.')
    }

    expect(pageCounts[0]).toBe(1)
    expect(pageCounts[1]).toBeLessThanOrEqual(2)
    expect(pageCounts[2]).toBeGreaterThan(1)
  }, 30000)
})
