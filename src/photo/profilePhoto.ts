const PHOTO_MAX_BYTES = 150 * 1024
const PHOTO_INPUT_MAX_BYTES = 8 * 1024 * 1024
const PHOTO_WIDTH = 450
const PHOTO_HEIGHT = 600

export { dataUrlToBlob, isSafePhotoDataUrl } from './data'

export async function processProfilePhoto(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Choose a JPG or PNG photo.')
  }
  if (file.size > PHOTO_INPUT_MAX_BYTES) {
    throw new Error('Choose a photo smaller than 8 MB.')
  }

  const image = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const aspect = PHOTO_WIDTH / PHOTO_HEIGHT
  const sourceAspect = image.width / image.height
  const sourceWidth = sourceAspect > aspect ? image.height * aspect : image.width
  const sourceHeight = sourceAspect > aspect ? image.height : image.width / aspect
  const sourceX = (image.width - sourceWidth) / 2
  const sourceY = (image.height - sourceHeight) / 2
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_WIDTH
  canvas.height = PHOTO_HEIGHT
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    image.close()
    throw new Error('This browser could not prepare the photo.')
  }
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT)
  image.close()

  const toJpeg = (quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('This photo could not be converted.')), 'image/jpeg', quality)
  })
  let processed = await toJpeg(0.82)
  if (processed.size > PHOTO_MAX_BYTES) processed = await toJpeg(0.68)
  if (processed.size > PHOTO_MAX_BYTES) {
    throw new Error('This photo stays over 150 KB after resizing. Choose a simpler image.')
  }
  return processed
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The photo could not be read.'))
    reader.onerror = () => reject(new Error('The photo could not be read.'))
    reader.readAsDataURL(blob)
  })
}

