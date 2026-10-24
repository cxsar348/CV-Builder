import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { extractRawText } from 'mammoth'
import { createResumeDocx } from '../../src/docx/export'
import { createSampleResume } from '../../src/data/model'

describe('DOCX export structure', () => {
  it('creates a readable one-column OpenXML document with no table or header/footer parts', async () => {
    const blob = await createResumeDocx(createSampleResume())
    const buffer = Buffer.from(await blob.arrayBuffer())
    expect(buffer.subarray(0, 2).toString()).toBe('PK')

    const archive = await JSZip.loadAsync(buffer)
    const documentXml = await archive.file('word/document.xml')?.async('string')
    expect(documentXml).toBeDefined()
    expect(documentXml).not.toMatch(/<w:tbl(?:\s|>)/u)
    expect(documentXml).not.toMatch(/<w:txbxContent(?:\s|>)/u)
    expect(documentXml).not.toMatch(/<w:framePr(?:\s|>)/u)
    expect(documentXml).not.toMatch(/<wp:anchor(?:\s|>)/u)
    expect(Object.keys(archive.files).some((path) => /word\/(?:header|footer)\d+\.xml$/u.test(path))).toBe(false)

    const extracted = await extractRawText({ buffer })
    expect(extracted.value).toContain('John Doe')
    expect(extracted.value).toContain('john.doe@example.com')
    expect(extracted.value).toContain('Professional Summary')
    expect(extracted.value).toContain('March 2022 – Present')
    expect(extracted.value).toContain('Automated 12 recurring reports')
  })
})
