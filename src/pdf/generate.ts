import type { ResumeData } from '../data/model'

export async function createResumePdf(data: ResumeData, photoDataUrl = '') {
  const [{ pdf }, { ResumePdfDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./document'),
  ])
  return pdf(ResumePdfDocument({ data, photoDataUrl }) as never).toBlob()
}
