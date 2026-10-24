import type { ResumeData } from '../data/model'
import { groupSkills, sectionLabels } from '../data/model'
import { formatDateRange } from '../data/cvText'
import { dataUrlToBlob } from '../photo/data'
import { getResumeAccent, getTemplate } from '../templates/registry'
import { emailValidationError, normalizeHttpUrl, phoneValidationError } from '../data/validation'

type EntryLike = ResumeData['work'][number]

function addEntryParagraphs(docx: typeof import('docx'), entry: EntryLike, data: ResumeData, templateFont: string, availableWidth: number) {
  const { Paragraph, TextRun, TabStopType } = docx
  const title = [entry.title.trim(), entry.organization.trim()].filter(Boolean).join(' | ')
  const date = formatDateRange(entry.startDate, entry.endDate, entry.present, data.meta.cvLanguage)
  const paragraphs = [new Paragraph({
    children: [
      new TextRun({ text: title || 'Role or degree', bold: true, font: templateFont }),
      ...(date && getTemplate(data.meta.templateId).datePlacement === 'right' ? [new TextRun({ text: `\t${date}`, font: templateFont, size: 19 })] : []),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: availableWidth }],
    spacing: { before: 100, after: 40 },
  })]

  if (date && getTemplate(data.meta.templateId).datePlacement === 'below') {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: date, font: templateFont, size: 19, color: '444444' })], spacing: { after: 40 } }))
  }
  if (entry.location.trim()) paragraphs.push(new Paragraph({ children: [new TextRun({ text: entry.location.trim(), font: templateFont, size: 19, color: '444444' })], spacing: { after: 40 } }))
  for (const bullet of entry.bullets.filter((item) => item.trim())) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `• ${bullet.trim()}`, font: templateFont, size: 20 })],
      indent: { left: 260 },
      spacing: { after: 40 },
    }))
  }
  return paragraphs
}

export async function createResumeDocx(data: ResumeData, photoDataUrl = '') {
  const docx = await import('docx')
  const { AlignmentType, Document, ExternalHyperlink, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } = docx
  const template = getTemplate(data.meta.templateId)
  const accent = getResumeAccent(data.meta.templateId, data.meta.accentColor).replace('#', '')
  const font = template.fontFamily === 'Times-Roman' ? 'Times New Roman' : 'Arial'
  const pageWidth = data.meta.pageSize === 'A4' ? 11906 : 12240
  const margin = Math.round(template.marginMm * 56.6929)
  const availableWidth = pageWidth - margin * 2
  const children: InstanceType<typeof Paragraph>[] = []
  const contactItems: { text: string; href?: string }[] = []
  if (data.basics.email.trim()) contactItems.push({ text: data.basics.email.trim(), href: emailValidationError(data.basics.email) ? undefined : `mailto:${data.basics.email.trim()}` })
  if (data.basics.phone.trim()) contactItems.push({ text: data.basics.phone.trim(), href: phoneValidationError(data.basics.phone) ? undefined : `tel:${data.basics.phone.trim().replace(/[^+\d]/gu, '')}` })
  if (data.basics.location.trim()) contactItems.push({ text: data.basics.location.trim() })
  if (data.basics.linkedin.trim()) contactItems.push({ text: data.basics.linkedin.trim(), href: normalizeHttpUrl(data.basics.linkedin) || undefined })
  if (data.basics.website.trim()) contactItems.push({ text: data.basics.website.trim(), href: normalizeHttpUrl(data.basics.website) || undefined })
  for (const link of data.basics.links) {
    if (link.url.trim()) contactItems.push({ text: [link.label.trim(), link.url.trim()].filter(Boolean).join(': '), href: normalizeHttpUrl(link.url) || undefined })
  }
  const contact = contactItems.map((item) => item.text).join('  |  ')
  const hasHeadline = Boolean(data.basics.headline.trim())
  const hasContact = Boolean(contact)
  const hasTopRule = template.headerRule === 'top' || template.headerRule === 'framed'
  const hasBottomRule = template.headerRule === 'bottom' || template.headerRule === 'framed'
  const lastHeaderKey = hasContact ? 'contact' : hasHeadline ? 'headline' : 'name'
  const topRule = hasTopRule ? { top: { color: accent, size: 6, space: 5, style: 'single' as never } } : undefined
  const bottomRule = hasBottomRule ? { bottom: { color: accent, size: 6, space: 4, style: 'single' as never } } : undefined
  if (photoDataUrl) {
    const photoBytes = new Uint8Array(await dataUrlToBlob(photoDataUrl).arrayBuffer())
    children.push(new Paragraph({
      children: [new ImageRun({
        type: 'jpg',
        data: photoBytes,
        transformation: { width: 106, height: 142 },
        altText: { name: 'Profile photo', description: 'Optional profile photo', title: 'Profile photo' },
      })],
      alignment: template.photoAlign === 'center' ? AlignmentType.CENTER : template.photoAlign === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 100 },
    }))
  }

  if (data.basics.name.trim()) {
    children.push(new Paragraph({
      children: [new TextRun({ text: data.basics.name.trim(), bold: true, font, size: template.nameSizePt * 2, color: accent })],
      alignment: template.nameAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      border: { ...(hasTopRule ? topRule : {}), ...(lastHeaderKey === 'name' ? bottomRule : {}) },
      spacing: { before: hasTopRule ? 100 : 0, after: hasHeadline ? 120 : 160 },
    }))
  }
  if (data.basics.headline.trim()) children.push(new Paragraph({
    children: [new TextRun({ text: data.basics.headline.trim(), font: template.headlineStyle === 'bold' ? (template.fontFamily === 'Times-Roman' ? 'Times New Roman' : 'Arial') : font, size: 21, bold: template.headlineStyle === 'bold', italics: template.headlineStyle === 'italic', color: template.headlineStyle === 'muted' ? '5F6368' : '242424' })],
    alignment: template.nameAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
    border: lastHeaderKey === 'headline' ? bottomRule : undefined,
    spacing: { after: hasContact ? 100 : 160 },
  }))
  if (contactItems.length) {
    const renderedContact = template.contactLayout === 'stacked' ? contactItems.map((item) => [item]) : [contactItems]
    renderedContact.forEach((item, index) => {
      const lastLine = index === renderedContact.length - 1
      const runs = item.flatMap((contactItem, itemIndex) => [
        ...(itemIndex ? [new TextRun({ text: '  |  ', font, size: 19, color: '444444' })] : []),
        contactItem.href
          ? new ExternalHyperlink({ link: contactItem.href, children: [new TextRun({ text: contactItem.text, font, size: 19, color: '444444' })] })
          : new TextRun({ text: contactItem.text, font, size: 19, color: '444444' }),
      ])
      children.push(new Paragraph({
        children: runs,
        alignment: template.nameAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        border: lastLine && lastHeaderKey === 'contact' ? bottomRule : undefined,
        spacing: { after: lastLine ? 180 : 0 },
      }))
    })
  }

  const activeKeys = data.meta.sectionOrder.filter((key) => data.meta.activeSections.includes(key))
  for (const key of activeKeys) {
    let label = key.startsWith('custom:')
      ? data.customSections.find((section) => section.id === key.slice(7))?.title ?? 'Additional Information'
      : sectionLabels[key as keyof typeof sectionLabels]?.[data.meta.cvLanguage] ?? key
    if (!label) continue
    children.push(new Paragraph({
      text: label,
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      border: template.headingStyle.includes('rule') ? { bottom: { color: accent, size: 6, space: 3, style: 'single' as never } } : undefined,
      spacing: { before: Math.round(template.sectionGapPt * 20), after: 80 },
      run: { bold: true, font, size: (template.baseSizePt + 0.5) * 2, color: accent },
    }))

    if (key === 'summary' && data.summary.trim()) {
      children.push(new Paragraph({ children: [new TextRun({ text: data.summary.trim(), font, size: template.baseSizePt * 2 })], spacing: { after: 80 } }))
    } else if (key === 'work') {
      data.work.forEach((entry) => children.push(...addEntryParagraphs(docx, entry, data, font, availableWidth)))
    } else if (key === 'education') {
      data.education.forEach((entry) => {
        const educationEntry = { ...entry, bullets: entry.gpa ? [...entry.bullets, `GPA: ${entry.gpa}`] : entry.bullets }
        children.push(...addEntryParagraphs(docx, educationEntry, data, font, availableWidth))
      })
    } else if (key === 'projects' || key === 'volunteer') {
      const entries = key === 'projects' ? data.projects : data.volunteer
      entries.forEach((entry) => children.push(...addEntryParagraphs(docx, entry, data, font, availableWidth)))
    } else if (key === 'skills') {
      const groups = groupSkills(data.skills.filter((skill) => skill.name.trim()))
      for (const [group, skills] of groups) {
        const terms = skills.map((skill) => skill.acronym.trim() ? `${skill.name.trim()} (${skill.acronym.trim()})` : skill.name.trim())
        children.push(new Paragraph({ children: [new TextRun({ text: `${group}: ${terms.join(', ')}`, font, size: template.baseSizePt * 2 })], spacing: { after: 60 } }))
      }
    } else if (key === 'certificates') {
      for (const certificate of data.certificates) {
        const name = certificate.acronym.trim() ? `${certificate.name.trim()} (${certificate.acronym.trim()})` : certificate.name.trim()
        const detail = [certificate.issuer, formatDateRange(certificate.date, '', false, data.meta.cvLanguage), certificate.credential, certificate.url].filter((value) => value.trim()).join(' | ')
        children.push(new Paragraph({ children: [new TextRun({ text: [name, detail].filter(Boolean).join(' | '), font, size: template.baseSizePt * 2 })], spacing: { after: 60 } }))
      }
    } else if (key === 'languages') {
      for (const language of data.languages.filter((item) => item.include)) children.push(new Paragraph({ children: [new TextRun({ text: `${language.name} | ${language.level}`, font, size: template.baseSizePt * 2 })], spacing: { after: 60 } }))
    } else if (key === 'awards') {
      for (const award of data.awards) {
        const detail = [award.name, award.issuer, formatDateRange(award.date, '', false, data.meta.cvLanguage), award.details].filter((value) => value.trim()).join(' | ')
        children.push(new Paragraph({ children: [new TextRun({ text: detail, font, size: template.baseSizePt * 2 })], spacing: { after: 60 } }))
      }
    } else if (key.startsWith('custom:')) {
      const custom = data.customSections.find((section) => section.id === key.slice(7))
      for (const bullet of custom?.bullets.filter((item) => item.trim()) ?? []) {
        children.push(new Paragraph({ children: [new TextRun({ text: `• ${bullet.trim()}`, font, size: template.baseSizePt * 2 })], indent: { left: 260 }, spacing: { after: 40 } }))
      }
    }
  }

  const document = new Document({
    title: data.basics.name.trim() ? `${data.basics.name.trim()} CV` : 'CV',
    creator: 'CV Builder',
    sections: [{
      properties: {
        page: {
          size: { width: pageWidth, height: data.meta.pageSize === 'A4' ? 16838 : 15840 },
          margin: { top: margin, bottom: margin, left: margin, right: margin },
        },
      },
      children,
    }],
  })
  return Packer.toBlob(document)
}
