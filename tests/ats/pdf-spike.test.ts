import { describe, expect, it } from 'vitest'
import { runPdfSpike } from '../../scripts/pdf-spike'

describe('Phase 0 native PDF feasibility', () => {
  it('preserves ATS-readable text in English, Spanish, and a long CV', async () => {
    const reports = await runPdfSpike()

    expect(reports.map((report) => report.fixture)).toEqual(['english', 'spanish', 'long'])
    expect(reports.every((report) => report.bytes > 0 && report.pageCount > 0)).toBe(true)
  })
})
