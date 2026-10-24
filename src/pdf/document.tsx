import { createElement, type ReactNode } from 'react'
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatDateRange } from '../data/cvText'
import { groupSkills, sectionLabels, type ResumeData } from '../data/model'
import { getResumeAccent, getTemplate, type TemplateTokens } from '../templates/registry'
import { emailValidationError, normalizeHttpUrl, phoneValidationError } from '../data/validation'

Font.registerHyphenationCallback((word) => [word])

type EntryLike = {
  title: string
  organization: string
  location: string
  startDate: string
  endDate: string
  present: boolean
  bullets: string[]
}

function fontWeightFamily(template: TemplateTokens) {
  return template.fontFamily === 'Times-Roman' ? 'Times-Bold' : 'Helvetica-Bold'
}

function cleanEntryText(value: string) {
  return value.trim()
}

function getSectionHeading(data: ResumeData, key: string) {
  if (key.startsWith('custom:')) {
    return data.customSections.find((section) => section.id === key.slice(7))?.title ?? 'Additional Information'
  }
  const label = sectionLabels[key as keyof typeof sectionLabels]
  return label?.[data.meta.cvLanguage] ?? key
}

function getContactItems(data: ResumeData) {
  const items: { text: string; href?: string }[] = []
  if (data.basics.email.trim()) items.push({ text: data.basics.email.trim(), href: emailValidationError(data.basics.email) ? undefined : `mailto:${data.basics.email.trim()}` })
  if (data.basics.phone.trim()) items.push({ text: data.basics.phone.trim(), href: phoneValidationError(data.basics.phone) ? undefined : `tel:${data.basics.phone.trim().replace(/[^+\d]/gu, '')}` })
  if (data.basics.location.trim()) items.push({ text: data.basics.location.trim() })
  if (data.basics.linkedin.trim()) items.push({ text: data.basics.linkedin.trim(), href: normalizeHttpUrl(data.basics.linkedin) || undefined })
  if (data.basics.website.trim()) items.push({ text: data.basics.website.trim(), href: normalizeHttpUrl(data.basics.website) || undefined })
  for (const link of data.basics.links) {
    if (!link.url.trim()) continue
    items.push({ text: [link.label.trim(), link.url.trim()].filter(Boolean).join(': '), href: normalizeHttpUrl(link.url) || undefined })
  }
  return items
}

function formatSkill(skill: ResumeData['skills'][number]) {
  return skill.acronym.trim() ? `${skill.name.trim()} (${skill.acronym.trim()})` : skill.name.trim()
}

function EntryBlock({ entry, template, data }: { entry: EntryLike; template: TemplateTokens; data: ResumeData }) {
  const titleLine = [cleanEntryText(entry.title), cleanEntryText(entry.organization)].filter(Boolean).join(' | ')
  const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.present, data.meta.cvLanguage)
  const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 5, gap: 12 },
    title: { fontFamily: fontWeightFamily(template), fontSize: template.baseSizePt, flexGrow: 1, flexShrink: 1 },
    date: { fontSize: template.baseSizePt - 0.5, color: '#444444', textAlign: 'right', flexShrink: 0 },
    belowDate: { fontSize: template.baseSizePt - 0.5, color: '#444444', marginTop: 1 },
    location: { fontSize: template.baseSizePt - 0.5, color: '#444444', marginTop: 1 },
    bullet: { marginLeft: 10, paddingLeft: 2, marginTop: 2 },
  })

  return createElement(
    View,
    {},
    createElement(
      View,
      { style: styles.header, wrap: false },
      createElement(Text, { style: styles.title }, titleLine || 'Role or degree'),
      template.datePlacement === 'right' && dateRange ? createElement(Text, { style: styles.date }, dateRange) : null,
    ),
    template.datePlacement === 'below' && dateRange ? createElement(Text, { style: styles.belowDate }, dateRange) : null,
    entry.location ? createElement(Text, { style: styles.location }, entry.location) : null,
    ...entry.bullets.filter((bullet) => bullet.trim()).map((bullet, index) => createElement(
      Text,
      { key: `bullet-${index}`, style: styles.bullet },
      `• ${bullet.trim()}`,
    )),
  )
}

function SectionBlock({ data, sectionKey, template }: { data: ResumeData; sectionKey: string; template: TemplateTokens }) {
  const headingText = getSectionHeading(data, sectionKey)
  const accent = getResumeAccent(data.meta.templateId, data.meta.accentColor)
  const styles = StyleSheet.create({
    heading: {
    fontFamily: fontWeightFamily(template),
    fontSize: template.baseSizePt + 0.5,
    color: accent,
    marginTop: template.sectionGapPt,
    marginBottom: 4,
    ...(template.headingStyle.includes('uppercase') ? { textTransform: 'uppercase' } : {}),
    ...(template.headingStyle.includes('rule') ? { borderBottomWidth: 0.7, borderBottomColor: accent, paddingBottom: 3 } : {}),
    },
  })

  let content: ReactNode[] = []
  if (sectionKey === 'summary') {
    content = data.summary.trim() ? [createElement(Text, { key: 'summary' }, data.summary.trim())] : []
  } else if (sectionKey === 'work') {
    content = data.work.map((entry) => createElement(EntryBlock, { key: entry.id, entry, template, data }))
  } else if (sectionKey === 'education') {
    content = data.education.map((entry) => createElement(EntryBlock, {
      key: entry.id,
      entry: { ...entry, bullets: entry.gpa ? [...entry.bullets, `GPA: ${entry.gpa}`] : entry.bullets },
      template,
      data,
    }))
  } else if (sectionKey === 'projects' || sectionKey === 'volunteer') {
    const entries = sectionKey === 'projects' ? data.projects : data.volunteer
    content = entries.map((entry) => createElement(EntryBlock, { key: entry.id, entry, template, data }))
  } else if (sectionKey === 'skills') {
    const groups = groupSkills(data.skills.filter((skill) => skill.name.trim()))
    content = groups.map(([group, skills]) => createElement(
      Text,
      { key: group, style: { marginTop: 2 } },
      `${group}: ${skills.map(formatSkill).join(', ')}`,
    ))
  } else if (sectionKey === 'certificates') {
    content = data.certificates.map((certificate) => {
      const title = certificate.acronym.trim() ? `${certificate.name.trim()} (${certificate.acronym.trim()})` : certificate.name.trim()
      const date = formatDateRange(certificate.date, '', false, data.meta.cvLanguage)
      const issuer = certificate.issuer.trim()
      const credential = [certificate.credential.trim(), certificate.url.trim()].filter(Boolean).join(' | ')
      return createElement(View, { key: certificate.id, style: { marginTop: 5 }, wrap: false },
        createElement(Text, { style: { fontFamily: fontWeightFamily(template) } }, [title, issuer].filter(Boolean).join(' | ')),
        date ? createElement(Text, { style: { fontSize: template.baseSizePt - 0.5, color: '#444444' } }, date) : null,
        credential ? createElement(Text, null, credential) : null,
      )
    })
  } else if (sectionKey === 'languages') {
    content = data.languages.filter((language) => language.include).map((language) => createElement(Text, { key: language.id, style: { marginTop: 2 } }, `${language.name} | ${language.level}`))
  } else if (sectionKey === 'awards') {
    content = data.awards.map((award) => createElement(View, { key: award.id, style: { marginTop: 5 }, wrap: false },
      createElement(Text, { style: { fontFamily: fontWeightFamily(template) } }, [award.name, award.issuer].filter(Boolean).join(' | ')),
      award.date ? createElement(Text, { style: { fontSize: template.baseSizePt - 0.5, color: '#444444' } }, formatDateRange(award.date, '', false, data.meta.cvLanguage)) : null,
      award.details ? createElement(Text, null, award.details) : null,
    ))
  } else if (sectionKey.startsWith('custom:')) {
    const custom = data.customSections.find((section) => section.id === sectionKey.slice(7))
    content = (custom?.bullets ?? []).filter((bullet) => bullet.trim()).map((bullet, index) => createElement(Text, { key: index, style: { marginLeft: 10, marginTop: 2 } }, `• ${bullet.trim()}`))
  }

  if (content.length === 0) return null
  return createElement(View, { key: sectionKey, wrap: true },
    createElement(Text, { style: styles.heading, minPresenceAhead: 22 }, headingText),
    ...content,
  )
}

export function ResumePdfDocument({ data, photoDataUrl = '' }: { data: ResumeData; photoDataUrl?: string }) {
  const template = getTemplate(data.meta.templateId)
  const accent = getResumeAccent(data.meta.templateId, data.meta.accentColor)
  const margin = (template.marginMm * 72) / 25.4
  const pageSize = data.meta.pageSize === 'A4' ? 'A4' : 'LETTER'
  const contactItems = getContactItems(data)
  const contactLine = contactItems.map((item) => item.text).join('  |  ')
  const hasHeadline = Boolean(data.basics.headline.trim())
  const hasContact = Boolean(contactLine)
  const hasTopRule = template.headerRule === 'top' || template.headerRule === 'framed'
  const hasBottomRule = template.headerRule === 'bottom' || template.headerRule === 'framed'
  const lastHeaderKey = hasContact ? 'contact' : hasHeadline ? 'headline' : 'name'
  const styles = StyleSheet.create({
    page: {
      paddingTop: margin,
      paddingBottom: margin,
      paddingHorizontal: margin,
      fontFamily: template.fontFamily,
      fontSize: template.baseSizePt,
      lineHeight: template.lineHeight,
      color: '#151515',
      backgroundColor: '#FFFFFF',
    },
    name: {
      fontFamily: fontWeightFamily(template),
      fontSize: template.nameSizePt,
      lineHeight: 1.08,
      color: accent,
      textAlign: template.nameAlign,
      paddingTop: hasTopRule ? 5 : 0,
      borderTopWidth: hasTopRule ? 0.8 : 0,
      borderTopColor: accent,
      borderBottomWidth: hasBottomRule && lastHeaderKey === 'name' ? 0.8 : 0,
      borderBottomColor: accent,
      paddingBottom: hasBottomRule && lastHeaderKey === 'name' ? 5 : 0,
    },
    headline: {
      textAlign: template.nameAlign,
      fontSize: template.baseSizePt + 0.5,
      lineHeight: 1.25,
      color: template.headlineStyle === 'muted' ? '#5F6368' : '#242424',
      fontFamily: template.headlineStyle === 'bold' ? fontWeightFamily(template) : template.fontFamily,
      fontStyle: template.headlineStyle === 'italic' ? 'italic' : 'normal',
      borderBottomWidth: hasBottomRule && lastHeaderKey === 'headline' ? 0.8 : 0,
      borderBottomColor: accent,
      paddingBottom: hasBottomRule && lastHeaderKey === 'headline' ? 5 : 0,
    },
    contact: {
      textAlign: template.nameAlign,
      fontSize: template.baseSizePt - 0.5,
      lineHeight: 1.25,
      color: '#444444',
      borderBottomWidth: hasBottomRule && lastHeaderKey === 'contact' ? 0.8 : 0,
      borderBottomColor: accent,
      paddingBottom: hasBottomRule && lastHeaderKey === 'contact' ? 5 : 0,
    },
    nameBlock: { marginTop: hasTopRule ? 5 : 0, marginBottom: 8 },
    headlineBlock: { marginTop: 2, marginBottom: 7 },
    contactBlock: { marginTop: hasHeadline ? 2 : 0, marginBottom: 9 },
    photo: {
      width: 79,
      height: 105,
      objectFit: 'cover',
      alignSelf: template.photoAlign === 'center' ? 'center' : template.photoAlign === 'right' ? 'flex-end' : 'flex-start',
      marginBottom: 9,
    },
  })
  const activeKeys = data.meta.sectionOrder.filter((key) => data.meta.activeSections.includes(key))
  const keys = activeKeys.length ? activeKeys : data.meta.activeSections
  return createElement(
    Document,
    { title: data.basics.name.trim() ? `${data.basics.name.trim()} CV` : 'CV', author: data.basics.name.trim() || 'CV Builder', subject: `${template.name} CV template` },
    createElement(
      Page,
      { size: pageSize, style: styles.page, wrap: true },
      photoDataUrl ? createElement(Image, { src: photoDataUrl, style: styles.photo }) : null,
      data.basics.name.trim() ? createElement(View, { style: styles.nameBlock }, createElement(Text, { style: styles.name }, data.basics.name.trim())) : null,
      data.basics.headline.trim() ? createElement(View, { style: styles.headlineBlock }, createElement(Text, { style: styles.headline }, data.basics.headline.trim())) : null,
      contactLine ? createElement(View, { style: styles.contactBlock }, createElement(Text, { style: styles.contact }, ...contactItems.flatMap((item, index) => [
        ...(index ? [createElement(Text, { key: `separator-${index}` }, '  |  ')] : []),
        item.href ? createElement(Link, { key: `contact-${index}`, src: item.href, style: { color: '#444444', textDecoration: 'none' } }, item.text) : createElement(Text, { key: `contact-${index}` }, item.text),
      ]))) : null,
      ...keys.map((key) => createElement(SectionBlock, { key, data, sectionKey: key, template })),
    ),
  )
}

export function getVisibleUrl(value: string) {
  if (!value.trim()) return ''
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    return url.toString().replace(/^https?:\/\//u, '')
  } catch {
    return value
  }
}

