import { z } from 'zod'
import { isResumeColor, migrateTemplateId, templateIds } from '../templates/registry'

const monthValue = z.string().regex(/^$|^\d{4}-(0[1-9]|1[0-2])$/u)

const EntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string(),
  location: z.string(),
  startDate: monthValue,
  endDate: monthValue,
  present: z.boolean(),
  bullets: z.array(z.string()),
})

export const skillCategoryDefaults = [
  { id: 'soft-skills', name: 'Soft Skills' },
  { id: 'technical-skills', name: 'Technical Skills' },
  { id: 'industry-skills', name: 'Industry-Specific Skills' },
  { id: 'tools-software', name: 'Tools & Software' },
  { id: 'custom-categories', name: 'Custom Categories' },
] as const

export const languageProficiencyLevels = ['Native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1', 'Fluent', 'Professional', 'Intermediate', 'Conversational', 'Basic'] as const
export type LanguageProficiency = typeof languageProficiencyLevels[number]

export function getDefaultLanguageEntries(interfaceLanguage = 'en') {
  const locale = interfaceLanguage.toLocaleLowerCase().split('-')[0]
  const native = locale === 'es' ? 'Spanish' : locale === 'en' ? 'English' : ''
  return [
    { id: 'suggested-english', name: 'English', level: native === 'English' ? 'Native' as const : 'Basic' as const, include: false },
    { id: 'suggested-spanish', name: 'Spanish', level: native === 'Spanish' ? 'Native' as const : 'Basic' as const, include: false },
  ]
}

export const ResumeSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    cvLanguage: z.enum(['en', 'es']),
    templateId: z.enum(templateIds).default('technical-ats'),
    accentColor: z.string().refine((value) => value === '' || isResumeColor(value), 'Enter a valid opaque HEX, RGB, or HSL color.').default(''),
    pageSize: z.enum(['A4', 'LETTER']),
    preset: z.enum(['experienced', 'student', 'career-changer']),
    activeSections: z.array(z.string()),
    sectionOrder: z.array(z.string()),
  }),
  basics: z.object({
    name: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string(),
    website: z.string(),
    links: z.array(z.object({ id: z.string(), label: z.string(), url: z.string() })).default([]),
  }),
  summary: z.string(),
  work: z.array(EntrySchema),
  education: z.array(EntrySchema.extend({ gpa: z.string() })),
  skills: z.array(z.object({ id: z.string(), name: z.string(), acronym: z.string(), group: z.string() })),
  skillCategories: z.array(z.object({ id: z.string(), name: z.string().min(1) })).default([...skillCategoryDefaults]),
  certificates: z.array(z.object({
    id: z.string(), name: z.string(), acronym: z.string(), issuer: z.string(), date: monthValue, credential: z.string(), url: z.string(),
  })),
  projects: z.array(EntrySchema),
  languages: z.array(z.object({ id: z.string(), name: z.string(), level: z.enum(languageProficiencyLevels), include: z.boolean().default(true) })),
  volunteer: z.array(EntrySchema),
  awards: z.array(z.object({ id: z.string(), name: z.string(), issuer: z.string(), date: monthValue, details: z.string() })),
  customSections: z.array(z.object({ id: z.string(), title: z.string(), bullets: z.array(z.string()) })),
})

export type ResumeData = z.infer<typeof ResumeSchema>
export type ResumeEntry = ResumeData['work'][number]
export type SkillCategory = ResumeData['skillCategories'][number]
export type SectionKey = 'summary' | 'work' | 'education' | 'skills' | 'certificates' | 'projects' | 'languages' | 'volunteer' | 'awards'

export function migrateResumeInput(value: unknown, interfaceLanguage = 'en'): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const source = value as Record<string, unknown>
  const meta = source.meta && typeof source.meta === 'object' && !Array.isArray(source.meta) ? source.meta as Record<string, unknown> : {}
  const basics = source.basics && typeof source.basics === 'object' && !Array.isArray(source.basics) ? source.basics as Record<string, unknown> : {}
  const skills = Array.isArray(source.skills) ? source.skills.map((item) => item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : item) : []
  const categories = Array.isArray(source.skillCategories) ? source.skillCategories.map((item) => item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : item) : [...skillCategoryDefaults]
  const categoryNames = new Set(categories.flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).name === 'string' ? [(item as Record<string, unknown>).name as string] : []).map((name) => name.trim().toLocaleLowerCase()))
  for (const skill of skills) {
    if (!skill || typeof skill !== 'object') continue
    const record = skill as Record<string, unknown>
    const group = typeof record.group === 'string' && record.group.trim() ? record.group.trim() : 'Technical Skills'
    if (!categoryNames.has(group.toLocaleLowerCase())) {
      categories.push({ id: `legacy-${group.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-')}`, name: group })
      categoryNames.add(group.toLocaleLowerCase())
    }
    record.group = group
  }
  const languages = Array.isArray(source.languages) ? source.languages.map((item) => item && typeof item === 'object' && !('include' in item) ? { ...(item as Record<string, unknown>), include: true } : item) : getDefaultLanguageEntries(interfaceLanguage)
  return {
    ...source,
    meta: { ...meta, templateId: migrateTemplateId(meta.templateId) },
    basics: { ...basics, links: Array.isArray(basics.links) ? basics.links : [] },
    skills,
    skillCategories: categories,
    languages,
  }
}

export function groupSkills(skills: ResumeData['skills']) {
  const groups = new Map<string, ResumeData['skills']>()
  for (const skill of skills) {
    const group = skill.group.trim() || 'Skills'
    groups.set(group, [...(groups.get(group) ?? []), skill])
  }
  return [...groups.entries()]
}

export const sectionLabels: Record<SectionKey, { en: string; es: string }> = {
  summary: { en: 'Professional Summary', es: 'Resumen Profesional' },
  work: { en: 'Work Experience', es: 'Experiencia Laboral' },
  education: { en: 'Education', es: 'Educación' },
  skills: { en: 'Skills', es: 'Habilidades' },
  certificates: { en: 'Certifications', es: 'Certificaciones' },
  projects: { en: 'Projects', es: 'Proyectos' },
  languages: { en: 'Languages', es: 'Idiomas' },
  volunteer: { en: 'Volunteer Experience', es: 'Voluntariado' },
  awards: { en: 'Awards', es: 'Reconocimientos' },
}

export const sectionKeys = Object.keys(sectionLabels) as SectionKey[]

export function createId() {
  return crypto.randomUUID()
}

export function createEntry(): ResumeEntry {
  return { id: createId(), title: '', organization: '', location: '', startDate: '', endDate: '', present: false, bullets: [''] }
}

export function sanitizeText(value: string) {
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/gu, '')
    .replace(/[\u00A0\u202F]/gu, ' ')
}

export function createEmptyResume(interfaceLanguage = 'en'): ResumeData {
  return {
    schemaVersion: 1,
    meta: {
      cvLanguage: 'en',
      templateId: 'technical-ats',
      accentColor: '',
      pageSize: 'A4',
      preset: 'experienced',
      activeSections: ['summary', 'skills', 'work', 'education', 'projects', 'languages'],
      sectionOrder: ['summary', 'skills', 'work', 'education', 'projects', 'languages', 'certificates', 'volunteer', 'awards'],
    },
    basics: { name: '', headline: '', email: '', phone: '', location: '', linkedin: '', website: '', links: [] },
    summary: '',
    work: [],
    education: [],
    skills: [],
    skillCategories: skillCategoryDefaults.map((category) => ({ ...category })),
    certificates: [],
    projects: [],
    languages: getDefaultLanguageEntries(interfaceLanguage),
    volunteer: [],
    awards: [],
    customSections: [],
  }
}

export function createSampleResume(interfaceLanguage = 'en'): ResumeData {
  const resume = createEmptyResume(interfaceLanguage)
  resume.basics = {
    name: 'John Doe',
    headline: 'Operations Analyst',
    email: 'john.doe@example.com',
    phone: '+58 777 123 4567',
    location: 'Caracas, Venezuela',
    linkedin: 'https://www.linkedin.com/in/johndoe',
    website: '',
    links: [],
  }
  resume.summary = 'Operations analyst with 5 years of experience improving reporting workflows and helping teams make clear, data-informed decisions.'
  resume.work = [{
    id: createId(), title: 'Operations Analyst', organization: 'Northstar Supply Co.', location: 'Austin, TX',
    startDate: '2022-03', endDate: '', present: true,
    bullets: [
      'Automated 12 recurring reports with SQL and Excel, reducing weekly preparation time by 35%.',
      'Partnered with 4 department leads to improve inventory accuracy from 91% to 97%.',
      'Built a monthly forecasting process that helped reduce stockouts by 18%.',
    ],
  }]
  resume.education = [{
    id: createId(), title: 'B.A. Business Analytics', organization: 'Example State University', location: 'Austin, TX',
    startDate: '2017-08', endDate: '2021-05', present: false, bullets: [], gpa: '',
  }]
  resume.skills = [
    { id: createId(), name: 'SQL', acronym: '', group: 'Technical Skills' },
    { id: createId(), name: 'Microsoft Excel', acronym: '', group: 'Tools & Software' },
    { id: createId(), name: 'Data Visualization', acronym: '', group: 'Technical Skills' },
    { id: createId(), name: 'Process Improvement', acronym: '', group: 'Industry-Specific Skills' },
    { id: createId(), name: 'Forecasting', acronym: '', group: 'Industry-Specific Skills' },
    { id: createId(), name: 'Project Management', acronym: '', group: 'Industry-Specific Skills' },
    { id: createId(), name: 'Stakeholder Management', acronym: '', group: 'Soft Skills' },
    { id: createId(), name: 'Python', acronym: '', group: 'Tools & Software' },
    { id: createId(), name: 'Power BI', acronym: '', group: 'Tools & Software' },
  ]
  resume.projects = [{
    id: createId(), title: 'Inventory Forecasting Dashboard', organization: 'Independent project', location: '',
    startDate: '2021-10', endDate: '2022-01', present: false,
    bullets: ['Created a Power BI dashboard to track 8 inventory measures across 3 regions.'],
  }]
  resume.meta.activeSections = ['summary', 'work', 'education', 'skills', 'projects', 'languages']
  resume.languages = [
    { id: createId(), name: 'English', level: 'Native', include: true },
    { id: createId(), name: 'Spanish', level: 'B2', include: true },
  ]
  return resume
}
