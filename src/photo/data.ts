export function dataUrlToBlob(dataUrl: string) {
  const match = /^data:(image\/jpeg);base64,([\da-z+/=]+)$/iu.exec(dataUrl)
  if (!match) throw new Error('The photo backup is not a supported JPEG image.')
  const binary = atob(match[2]!)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: 'image/jpeg' })
}

export function isSafePhotoDataUrl(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 150 * 1024 * 1.5
    && /^data:image\/jpeg;base64,[\da-z+/=]+$/iu.test(value)
}
