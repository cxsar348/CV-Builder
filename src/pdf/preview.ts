import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfPreviewResult = { pageCount: number; text: string }

export async function renderPdfPreview(data: Uint8Array, container: HTMLElement): Promise<PdfPreviewResult> {
  const documentTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs-standard-fonts/`,
  })
  const document = await documentTask.promise
  container.replaceChildren()
  const textPages: string[] = []
  const deviceScale = Math.min(window.devicePixelRatio || 1, 2)

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    const pageWidth = Math.max(320, container.clientWidth - 40)
    const scale = Math.min(pageWidth / baseViewport.width, 1.25)
    const viewport = page.getViewport({ scale: scale * deviceScale })
    const canvas = window.document.createElement('canvas')
    canvas.className = 'pdf-page-canvas'
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const canvasContext = canvas.getContext('2d', { alpha: false })
    if (!canvasContext) throw new Error('This browser could not prepare the CV preview canvas.')
    await page.render({ canvas, canvasContext, viewport }).promise
    container.append(canvas)

    const pageText = await page.getTextContent()
    textPages.push(pageText.items.map((item) => ('str' in item ? item.str : '')).join('\n'))
  }

  return { pageCount: document.numPages, text: textPages.join('\n\n') }
}
