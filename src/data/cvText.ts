import type { ResumeData } from './model'

export type CvLanguage = ResumeData['meta']['cvLanguage']

export const cvCopy = {
  en: {
    present: 'Present',
    skillGroup: 'Skills',
    levels: {
      Native: 'Native', Fluent: 'Fluent', Professional: 'Professional', Intermediate: 'Intermediate', Basic: 'Basic',
    },
  },
  es: {
    present: 'Presente',
    skillGroup: 'Habilidades',
    levels: {
      Native: 'Nativo', Fluent: 'Fluido', Professional: 'Profesional', Intermediate: 'Intermedio', Basic: 'Básico',
    },
  },
} satisfies Record<CvLanguage, { present: string; skillGroup: string; levels: Record<string, string> }>

export function formatMonth(value: string, language: CvLanguage) {
  if (!value) return ''
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, 1))
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatDateRange(start: string, end: string, present: boolean, language: CvLanguage) {
  const startLabel = formatMonth(start, language)
  const endLabel = present ? cvCopy[language].present : formatMonth(end, language)
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`
  return startLabel || endLabel
}
