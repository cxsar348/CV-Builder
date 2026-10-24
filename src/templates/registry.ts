export type TemplateCategory = 'Executive' | 'Modern' | 'Professional' | 'ATS-first'
export type TemplateOrder = 'executive' | 'modern' | 'professional' | 'technical'
export type TemplatePreviewStyle = 'classic' | 'modern' | 'compact' | 'plain'
export type TemplateHeaderRule = 'none' | 'top' | 'bottom' | 'framed'
export type TemplateHeadlineStyle = 'regular' | 'italic' | 'muted' | 'bold'
export type TemplateContactLayout = 'inline' | 'stacked'

type TemplateDefinition = {
  id: string
  name: string
  description: string
  category: TemplateCategory
  fontFamily: 'Helvetica' | 'Times-Roman'
  baseSizePt: number
  lineHeight: number
  marginMm: number
  accent: string
  nameAlign: 'left' | 'center'
  nameSizePt: number
  headingStyle: 'bold' | 'uppercase' | 'rule-below' | 'uppercase-rule'
  headerRule: TemplateHeaderRule
  headlineStyle: TemplateHeadlineStyle
  contactLayout: TemplateContactLayout
  sectionGapPt: number
  datePlacement: 'right' | 'below'
  photoAlign: 'left' | 'center' | 'right'
  order: TemplateOrder
  previewStyle: TemplatePreviewStyle
}

const definitions = [
  {
    id: 'executive', name: 'Executive', category: 'Executive',
    description: 'A formal serif hierarchy with a prominent summary and measured experience sections.',
    fontFamily: 'Times-Roman', baseSizePt: 10.5, lineHeight: 1.3, marginMm: 21,
    accent: '#26364B', nameAlign: 'center', nameSizePt: 26, headingStyle: 'uppercase-rule',
    headerRule: 'bottom', headlineStyle: 'italic', contactLayout: 'inline', sectionGapPt: 14,
    datePlacement: 'right', photoAlign: 'center', order: 'executive', previewStyle: 'classic',
  },
  {
    id: 'modern-minimal', name: 'Modern Minimal', category: 'Modern',
    description: 'Open sans-serif styling, generous whitespace, and clear section dividers.',
    fontFamily: 'Helvetica', baseSizePt: 10.5, lineHeight: 1.35, marginMm: 21,
    accent: '#20536B', nameAlign: 'left', nameSizePt: 27, headingStyle: 'rule-below',
    headerRule: 'top', headlineStyle: 'muted', contactLayout: 'inline', sectionGapPt: 15,
    datePlacement: 'right', photoAlign: 'left', order: 'modern', previewStyle: 'modern',
  },
  {
    id: 'professional', name: 'Professional', category: 'Professional',
    description: 'A balanced single-column format with compact contact details and grouped skills.',
    fontFamily: 'Helvetica', baseSizePt: 10.5, lineHeight: 1.25, marginMm: 18,
    accent: '#365746', nameAlign: 'left', nameSizePt: 24, headingStyle: 'bold',
    headerRule: 'framed', headlineStyle: 'regular', contactLayout: 'stacked', sectionGapPt: 10,
    datePlacement: 'below', photoAlign: 'left', order: 'professional', previewStyle: 'plain',
  },
  {
    id: 'technical-ats', name: 'Technical / ATS-First', category: 'ATS-first',
    description: 'A compact, conventional text-first layout with standard headings and simple chronology.',
    fontFamily: 'Helvetica', baseSizePt: 10, lineHeight: 1.18, marginMm: 15,
    accent: '#2B4355', nameAlign: 'left', nameSizePt: 22, headingStyle: 'uppercase',
    headerRule: 'none', headlineStyle: 'regular', contactLayout: 'inline', sectionGapPt: 8,
    datePlacement: 'below', photoAlign: 'left', order: 'technical', previewStyle: 'compact',
  },
] as const satisfies readonly TemplateDefinition[]

export type TemplateId = typeof definitions[number]['id']
export type TemplateTokens = TemplateDefinition & { id: TemplateId }

export const templates: TemplateTokens[] = definitions as unknown as TemplateTokens[]
export const templateIds = templates.map((template) => template.id) as [TemplateId, ...TemplateId[]]
export const templateCategories: TemplateCategory[] = [...new Set(templates.map((template) => template.category))]

type RgbColor = { red: number; green: number; blue: number }

function parseRgbChannel(value: string) {
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) {
    const percentage = Number.parseFloat(trimmed)
    return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? Math.round((percentage / 100) * 255) : null
  }
  const channel = Number(trimmed)
  return Number.isFinite(channel) && channel >= 0 && channel <= 255 ? Math.round(channel) : null
}

function parseHue(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:deg|turn|rad)?$/u.test(trimmed)) return null
  const number = Number.parseFloat(trimmed)
  if (!Number.isFinite(number)) return null
  const degrees = trimmed.endsWith('turn') ? number * 360 : trimmed.endsWith('rad') ? number * (180 / Math.PI) : number
  return ((degrees % 360) + 360) % 360
}

function parsePercentage(value: string) {
  const trimmed = value.trim()
  if (!trimmed.endsWith('%')) return null
  const percentage = Number.parseFloat(trimmed)
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? percentage / 100 : null
}

/** Parses the opaque CSS formats used by Coloris when its format toggle is enabled. */
export function parseResumeColor(value: string): RgbColor | null {
  const trimmed = value.trim()
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/iu.exec(trimmed)
  if (hex) {
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map((digit) => digit + digit).join('') : hex[1]!
    return {
      red: Number.parseInt(digits.slice(0, 2), 16),
      green: Number.parseInt(digits.slice(2, 4), 16),
      blue: Number.parseInt(digits.slice(4, 6), 16),
    }
  }

  const rgb = /^rgb\((.*)\)$/iu.exec(trimmed)
  if (rgb) {
    const values = rgb[1]!.split(/\s*,\s*|\s+/u).filter(Boolean)
    if (values.length !== 3) return null
    const [red, green, blue] = values.map(parseRgbChannel)
    return red === null || green === null || blue === null ? null : { red, green, blue }
  }

  const hsl = /^hsl\((.*)\)$/iu.exec(trimmed)
  if (!hsl) return null
  const values = hsl[1]!.split(/\s*,\s*|\s+/u).filter(Boolean)
  if (values.length !== 3) return null
  const hue = parseHue(values[0]!)
  const saturation = parsePercentage(values[1]!)
  const lightness = parsePercentage(values[2]!)
  if (hue === null || saturation === null || lightness === null) return null
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lightness - chroma / 2
  const channels = hue < 60 ? [chroma, secondary, 0] : hue < 120 ? [secondary, chroma, 0] : hue < 180 ? [0, chroma, secondary] : hue < 240 ? [0, secondary, chroma] : hue < 300 ? [secondary, 0, chroma] : [chroma, 0, secondary]
  return { red: Math.round((channels[0]! + offset) * 255), green: Math.round((channels[1]! + offset) * 255), blue: Math.round((channels[2]! + offset) * 255) }
}

export function isResumeColor(value: string) {
  return parseResumeColor(value) !== null
}

function toHex({ red, green, blue }: RgbColor) {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function getTemplate(id: string) {
  return templates.find((template) => template.id === id) ?? templates[0]!
}

export function getTemplateOrder(id: string) {
  const order = getTemplate(id).order
  if (order === 'executive') return ['summary', 'work', 'education', 'skills', 'certificates', 'projects', 'languages', 'volunteer', 'awards']
  if (order === 'modern') return ['summary', 'work', 'projects', 'skills', 'education', 'certificates', 'languages', 'volunteer', 'awards']
  if (order === 'professional') return ['summary', 'work', 'education', 'skills', 'projects', 'certificates', 'languages', 'volunteer', 'awards']
  return ['skills', 'work', 'education', 'projects', 'summary', 'certificates', 'languages', 'volunteer', 'awards']
}

export function readableAccent(color: string) {
  const normalized = toHex(parseResumeColor(color) ?? parseResumeColor('#26364B')!)
  const toRgb = (hex: string) => hex.slice(1).match(/.{2}/gu)!.map((value) => Number.parseInt(value, 16))
  const luminance = (hex: string) => {
    const [red, green, blue] = toRgb(hex).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
  }
  const contrast = (color: string) => 1.05 / (luminance(color) + 0.05)
  if (contrast(normalized) >= 4.5) return normalized
  const [red, green, blue] = toRgb(normalized)
  for (let step = 1; step <= 20; step += 1) {
    const factor = 1 - step * 0.05
    const candidate = `#${[red, green, blue].map((channel) => Math.round(channel * factor).toString(16).padStart(2, '0')).join('')}`
    if (contrast(candidate) >= 4.5) return candidate
  }
  return '#333333'
}

export function getResumeAccent(templateId: string, customColor = '') {
  return readableAccent(customColor || getTemplate(templateId).accent)
}

export function migrateTemplateId(templateId: unknown): TemplateId {
  if (typeof templateId === 'string' && templateIds.includes(templateId as TemplateId)) return templateId as TemplateId
  if (templateId === 'classic' || templateId === 'serif-heritage' || templateId === 'executive-brief' || templateId === 'consulting-focus' || templateId === 'finance-precision' || templateId === 'legal-formal' || templateId === 'academic-scholar' || templateId === 'research-first') return 'executive'
  if (templateId === 'modern' || templateId === 'swiss-modern' || templateId === 'ocean-blue' || templateId === 'evergreen' || templateId === 'terracotta' || templateId === 'plum-editorial' || templateId === 'modern-left-rule' || templateId === 'editorial-center') return 'modern-minimal'
  if (templateId === 'student' || templateId === 'graduate-launch' || templateId === 'internship-starter' || templateId === 'career-pivot') return 'professional'
  if (templateId === 'compact' || templateId === 'compact-impact' || templateId === 'plain' || templateId === 'technical-plain' || templateId === 'engineering-detail' || templateId === 'charcoal-minimal' || templateId === 'international-simple') return 'technical-ats'
  return 'professional'
}
