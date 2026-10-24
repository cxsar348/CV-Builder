declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer | Uint8Array }): Promise<{
    value: string
    messages: Array<{ type: string; message: string }>
  }>
}
