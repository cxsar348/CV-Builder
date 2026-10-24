import { sectionLabels, type ResumeData } from '../data/model'
import { emailValidationError, phoneValidationError, urlValidationError } from '../data/validation'
import { getResumeAccent } from '../templates/registry'

export type CheckStatus = 'passed' | 'suggestion' | 'warning'
export type AtsCheck = { id: string; status: CheckStatus; message: string; group?: 'category' }
export type SkillRecommendation = { id: string; name: string; group: string; status: CheckStatus; message: string }

export const atsRuleHelp: Record<string, string> = {
  'FMT-1': 'Confirms the exports use selectable text and that the ATS version leaves out an optional photo.',
  'LAY-1': 'Confirms the chosen template keeps all content in one top-to-bottom column.',
  'LAY-2': 'Confirms contact details are regular text in the document body, where parsing software can read them.',
  'LAY-3': 'Confirms the layout avoids tables, sidebars, frames, floating text, and text boxes.',
  'KEY-3': 'Checks that the selected accent color has enough contrast against white paper for readable headings.',
  'APP-1': 'This is a reminder rather than a document scan: application forms can ask for details such as work authorization or required licenses.',
  'PHT-1': 'Shows whether an optional photo is selected. The ATS export excludes it; a separate photo version is available for direct sharing or print.',
  'CONTACT': 'Checks that the CV has both a name and email address so the document identifies you and gives employers a way to respond.',
  'EM-1': 'Checks the entered email address for a reasonable name@domain format. It does not require a particular provider or domain.',
  'PH-1': 'Checks for an optional international number with 7–15 digits, an optional leading plus sign, and common spacing or punctuation.',
  'URL-1': 'Checks that LinkedIn, portfolio, and additional contact links use valid HTTP or HTTPS addresses.',
  'TYP-2': 'Scans CV text for arrows, check marks, and emoji that may be read as stray characters. Standard bullet points are added by the export.',
  'KEY-1': 'Checks that acronym entries also have their spelled-out name, such as “Project Management Professional (PMP)”.',
  'HDR-1': 'Checks custom category titles against common section labels and suggests a standard heading when one fits.',
  'DAT-1': 'Checks work and education entries for a start month and an end month, or a current-role marker.',
  'DEN-2': 'Counts named skills and suggests a focused list of about 8–12 items.',
  'KEY-2': 'Checks whether a listed skill is repeated more than four times in the CV text.',
  'KEY-4': 'Checks whether each listed skill is supported by a work, project, education, or volunteer bullet.',
  'DEN-3': 'Checks that each work entry stays near 3–5 impact bullets.',
  'BUL-1': 'Checks experience bullets for an action verb at the start and a numeric result. Add numbers only when accurate.',
  'DEN-1': 'Counts pages in the freshly rendered PDF and suggests keeping the CV to one or two pages.',
  'LANG': 'Shows which language is selected for standard section headings and date formatting.',
  'CAT-SUMMARY': 'Reviews the Professional Summary category for a concise, role-focused introduction.',
  'CAT-WORK': 'Reviews Work Experience for dated roles and a focused set of impact bullets.',
  'CAT-EDUCATION': 'Reviews Education for at least one useful qualification, institution, or study entry.',
  'CAT-SKILLS': 'Reviews the Skills category for a focused, readable list of role-relevant terms.',
  'CAT-CERTIFICATES': 'Reviews Certifications for named credentials and, when available, their issuing organization.',
  'CAT-PROJECTS': 'Reviews Projects for examples that show what you built, researched, or delivered.',
  'CAT-LANGUAGES': 'Reviews Languages for names and proficiency levels.',
  'CAT-VOLUNTEER': 'Reviews Volunteer Experience for relevant service, responsibilities, or outcomes.',
  'CAT-AWARDS': 'Reviews Awards for a named recognition and its issuer or context.',
}

const forbiddenSymbols = /[→✓✔☑☒✅☐➡️🔹🔸⭐]/u
const actionVerbs = {
  en: ['built', 'created', 'designed', 'developed', 'improved', 'increased', 'decreased', 'reduced', 'managed', 'led', 'launched', 'automated', 'analyzed', 'implemented', 'delivered', 'partnered', 'coordinated', 'streamlined', 'generated', 'trained', 'negotiated', 'supported', 'maintained', 'organized'],
  es: ['analicé', 'automaticé', 'aumenté', 'coordiné', 'creé', 'desarrollé', 'diseñé', 'dirigí', 'entregué', 'implementé', 'lancé', 'lideré', 'mejoré', 'negocié', 'organicé', 'reduje', 'gestioné', 'optimicé', 'colaboré'],
}

function allText(data: ResumeData) {
  return [
    data.basics.name, data.basics.headline, data.basics.email, data.basics.phone, data.basics.location,
    data.basics.linkedin, data.basics.website, ...data.basics.links.flatMap((link) => [link.label, link.url]), data.summary,
    ...data.work.flatMap((entry) => [entry.title, entry.organization, ...entry.bullets]),
    ...data.education.flatMap((entry) => [entry.title, entry.organization, ...entry.bullets]),
    ...data.projects.flatMap((entry) => [entry.title, entry.organization, ...entry.bullets]),
    ...data.volunteer.flatMap((entry) => [entry.title, entry.organization, ...entry.bullets]),
    ...data.skills.flatMap((skill) => [skill.name, skill.acronym]),
    ...data.certificates.map((certificate) => `${certificate.name} ${certificate.acronym} ${certificate.issuer}`),
    ...data.languages.filter((language) => language.include).map((language) => language.name),
    ...data.awards.map((award) => `${award.name} ${award.issuer} ${award.details}`),
    ...data.customSections.flatMap((section) => [section.title, ...section.bullets]),
  ].filter(Boolean).join(' ')
}

function mentionCount(haystack: string, needle: string) {
  if (!needle.trim()) return 0
  return [...haystack.matchAll(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'giu'))].length
}

function bulletsFor(data: ResumeData) {
  return [
    ...data.work.flatMap((entry) => entry.bullets),
    ...data.education.flatMap((entry) => entry.bullets),
    ...data.projects.flatMap((entry) => entry.bullets),
    ...data.volunteer.flatMap((entry) => entry.bullets),
    ...data.certificates.map((certificate) => certificate.name),
  ]
}

export function lintResume(data: ResumeData, pageCount: number, hasPhoto = false): AtsCheck[] {
  const text = allText(data)
  const bulletText = bulletsFor(data).join(' ')
  const checks: AtsCheck[] = [
    { id: 'FMT-1', status: 'passed', message: 'PDF and DOCX keep selectable text; the ATS export contains no photo.' },
    { id: 'LAY-1', status: 'passed', message: 'The selected template uses a single-column reading order.' },
    { id: 'LAY-2', status: 'passed', message: 'Contact details appear in the document body.' },
    { id: 'LAY-3', status: 'passed', message: 'No tables, frames, sidebars, or text boxes are used.' },
    { id: 'KEY-3', status: 'passed', message: `The ${getResumeAccent(data.meta.templateId, data.meta.accentColor)} accent meets readable contrast on white paper.` },
    { id: 'APP-1', status: 'suggestion', message: 'Answer application form questions accurately, including work authorization, licenses, location, and salary expectations.' },
  ]

  checks.push(hasPhoto
    ? { id: 'PHT-1', status: 'suggestion', message: 'A photo is available for print or direct email. Use the ATS export for online portals; it excludes the photo.' }
    : { id: 'PHT-1', status: 'passed', message: 'No photo is included in the ATS version.' })

  if (!data.basics.name.trim() || !data.basics.email.trim()) {
    checks.push({ id: 'CONTACT', status: 'warning', message: 'Add your name and email address.' })
  } else {
    checks.push({ id: 'CONTACT', status: 'passed', message: 'Name and email are present.' })
  }

  checks.push(emailValidationError(data.basics.email)
    ? { id: 'EM-1', status: 'warning', message: emailValidationError(data.basics.email) }
    : { id: 'EM-1', status: 'passed', message: data.basics.email.trim() ? 'Email format looks valid.' : 'Email is optional until you are ready to add it.' })
  checks.push(phoneValidationError(data.basics.phone)
    ? { id: 'PH-1', status: 'warning', message: phoneValidationError(data.basics.phone) }
    : { id: 'PH-1', status: 'passed', message: data.basics.phone.trim() ? 'Phone number uses a supported international format.' : 'Phone number is optional.' })
  const contactUrls = [data.basics.linkedin, data.basics.website, ...data.basics.links.map((link) => link.url)].filter((url) => url.trim())
  const invalidContactUrl = contactUrls.find((url) => urlValidationError(url))
  checks.push(invalidContactUrl
    ? { id: 'URL-1', status: 'warning', message: `“${invalidContactUrl}” is not a valid HTTP or HTTPS URL.` }
    : { id: 'URL-1', status: 'passed', message: contactUrls.length ? 'Contact links use valid HTTP or HTTPS URLs.' : 'Contact links are optional.' })

  checks.push(forbiddenSymbols.test(text)
    ? { id: 'TYP-2', status: 'warning', message: 'Replace arrows, check marks, or emoji with plain words. The export adds standard bullets automatically.' }
    : { id: 'TYP-2', status: 'passed', message: 'No unsupported symbol characters found.' })

  const acronymMissingFullName = [...data.skills, ...data.certificates].find((item) => item.acronym.trim() && !item.name.trim())
  checks.push(acronymMissingFullName
    ? { id: 'KEY-1', status: 'warning', message: 'Add the full term wherever you include an acronym.' }
    : { id: 'KEY-1', status: 'passed', message: 'Acronyms are paired with full names in the exported skills and certification lines.' })

  const customTitle = data.customSections.find((section) => section.title.trim() && !Object.values(sectionLabels).some((labels) => Object.values(labels).some((label) => label.toLocaleLowerCase() === section.title.trim().toLocaleLowerCase())))
  checks.push(customTitle
    ? { id: 'HDR-1', status: 'suggestion', message: `“${customTitle.title}” is a custom heading. Use a standard heading when it fits.` }
    : { id: 'HDR-1', status: 'passed', message: 'Built-in headings use standard section titles.' })

  const incompleteDates = [...data.work, ...data.education].some((entry) => entry.title.trim() && (!entry.startDate || (!entry.endDate && !entry.present)))
  checks.push(incompleteDates
    ? { id: 'DAT-1', status: 'warning', message: 'Add a start and end month for each dated role or education entry.' }
    : { id: 'DAT-1', status: 'passed', message: 'Dates use month and year fields.' })

  const skillsCount = data.skills.filter((skill) => skill.name.trim()).length
  checks.push(skillsCount < 8
    ? { id: 'DEN-2', status: 'suggestion', message: `${skillsCount} skills listed; 8–12 focused skills are a useful target.` }
    : skillsCount > 20
      ? { id: 'DEN-2', status: 'warning', message: `${skillsCount} skills listed; trim the list to the most relevant ones.` }
      : skillsCount > 12
        ? { id: 'DEN-2', status: 'suggestion', message: `${skillsCount} skills listed; consider keeping the list to 12 or fewer.` }
        : { id: 'DEN-2', status: 'passed', message: `${skillsCount} focused skills listed.` })

  const overused = data.skills.find((skill) => skill.name.trim() && mentionCount(text, skill.name) > 4)
  checks.push(overused
    ? { id: 'KEY-2', status: 'warning', message: `“${overused.name}” appears more than 4 times. Reduce repetition.` }
    : { id: 'KEY-2', status: 'passed', message: 'No core skill appears more than 4 times.' })

  const unanchored = data.skills.find((skill) => skill.name.trim() && ![skill.name, skill.acronym].filter(Boolean).some((term) => mentionCount(bulletText, term) > 0))
  checks.push(unanchored
    ? { id: 'KEY-4', status: 'suggestion', message: `Add “${unanchored.name}” to a relevant experience, project, education, or volunteer bullet.` }
    : { id: 'KEY-4', status: 'passed', message: 'Listed skills are supported by experience or project bullets.' })

  const thinJob = data.work.find((entry) => entry.title.trim() && entry.bullets.filter((bullet) => bullet.trim()).length < 3)
  const longJob = data.work.find((entry) => entry.title.trim() && entry.bullets.filter((bullet) => bullet.trim()).length > 5)
  checks.push(thinJob
    ? { id: 'DEN-3', status: 'suggestion', message: 'Add more impact bullets to each role; 3–5 is a useful range.' }
    : longJob
      ? { id: 'DEN-3', status: 'suggestion', message: 'Some roles have more than 5 bullets. Keep the strongest examples.' }
      : { id: 'DEN-3', status: 'passed', message: 'Work entries have a focused bullet count.' })

  const verbs = actionVerbs[data.meta.cvLanguage]
  const experienceBullets = [...data.work, ...data.projects, ...data.volunteer, ...data.education].flatMap((entry) => entry.bullets).filter((bullet) => bullet.trim())
  const weakBullet = experienceBullets.find((bullet) => !/\d/u.test(bullet) || !verbs.some((verb) => bullet.trim().toLocaleLowerCase().startsWith(verb)))
  checks.push(weakBullet || experienceBullets.length === 0
    ? { id: 'BUL-1', status: 'suggestion', message: 'Strengthen bullets with an action verb and a number, percentage, or amount where it is accurate.' }
    : { id: 'BUL-1', status: 'passed', message: 'Bullets start with an action verb and include a numeric result.' })

  if (pageCount > 0) {
    checks.push(pageCount > 2
      ? { id: 'DEN-1', status: 'warning', message: `The current PDF is ${pageCount} pages. Aim for 1–2 pages.` }
      : { id: 'DEN-1', status: 'passed', message: `${pageCount} page${pageCount === 1 ? '' : 's'} in the current PDF.` })
  } else {
    checks.push({ id: 'DEN-1', status: 'suggestion', message: 'Page count is unavailable until the current PDF preview is ready.' })
  }

  checks.push({ id: 'LANG', status: 'passed', message: `CV headings and dates use ${data.meta.cvLanguage === 'es' ? 'Spanish' : 'English'}.` })
  checks.push(...getCategoryRecommendations(data))
  return checks
}

function getCategoryRecommendations(data: ResumeData): AtsCheck[] {
  const skills = data.skills.filter((skill) => skill.name.trim())
  const summaryLength = data.summary.trim().length
  const summarySentences = data.summary.trim().split(/[.!?]+\s*/u).filter(Boolean).length
  const workEntries = data.work.filter((entry) => entry.title.trim() || entry.organization.trim())
  const educationEntries = data.education.filter((entry) => entry.title.trim() || entry.organization.trim())
  const certificates = data.certificates.filter((item) => item.name.trim())
  const projects = data.projects.filter((entry) => entry.title.trim() || entry.organization.trim())
  const languages = data.languages.filter((item) => item.include && item.name.trim())
  const volunteer = data.volunteer.filter((entry) => entry.title.trim() || entry.organization.trim())
  const awards = data.awards.filter((item) => item.name.trim())
  const checks: AtsCheck[] = []
  const add = (id: string, status: CheckStatus, message: string) => checks.push({ id, status, message, group: 'category' })

  if (!summaryLength) add('CAT-SUMMARY', 'suggestion', 'Add a concise, tailored introduction that connects your experience and strengths to the target role.')
  else if (summaryLength < 60 || summarySentences < 2) add('CAT-SUMMARY', 'suggestion', 'Expand this into 2–4 short sentences with your focus, relevant strengths, and the value you bring.')
  else add('CAT-SUMMARY', 'passed', 'A summary is present. Keep it specific to the role and support its claims in the sections below.')

  if (!workEntries.length) add('CAT-WORK', 'suggestion', 'Add relevant work experience when applicable. Include role, organization, dates, and results-focused bullets.')
  else if (workEntries.some((entry) => entry.bullets.filter((bullet) => bullet.trim()).length < 3)) add('CAT-WORK', 'suggestion', 'Give each relevant role 3–5 concise bullets showing actions, scope, and outcomes.')
  else add('CAT-WORK', 'passed', 'Work entries are present with at least three non-empty bullets. Keep the strongest, most relevant results.')

  if (!educationEntries.length) add('CAT-EDUCATION', 'suggestion', 'Add relevant education or training, including the qualification and institution. Include dates when useful.')
  else add('CAT-EDUCATION', 'passed', 'Education entries are present. Keep the qualification and institution easy to identify.')

  if (skills.length < 8) add('CAT-SKILLS', 'suggestion', `${skills.length} named skill${skills.length === 1 ? '' : 's'} so far. Add relevant tools and capabilities toward a focused 8–12; connect each to evidence below.`)
  else if (skills.length > 12) add('CAT-SKILLS', 'warning', `${skills.length} named skills. Trim this list to the most relevant 8–12 for the role.`)
  else add('CAT-SKILLS', 'passed', `${skills.length} named skills. Review that each is relevant and supported by experience, projects, education, or service.`)

  const namedGroups = new Set(data.skillCategories.map((category) => category.name.trim()).filter(Boolean))
  for (const group of namedGroups) {
    const groupSkills = skills.filter((skill) => skill.group.trim().toLocaleLowerCase() === group.toLocaleLowerCase())
    if (groupSkills.length) add(`CAT-SKILL-${group.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-')}`, 'passed', `${group}: ${groupSkills.length} selected skill${groupSkills.length === 1 ? '' : 's'}. Keep only capabilities you can support with examples.`)
  }

  if (!certificates.length) add('CAT-CERTIFICATES', 'suggestion', 'Add role-relevant certifications or licenses if you hold them. This category is optional.')
  else if (data.certificates.some((item) => item.name.trim() && !item.issuer.trim())) add('CAT-CERTIFICATES', 'suggestion', 'Add the issuing organization to credentials when it helps employers verify them.')
  else add('CAT-CERTIFICATES', 'passed', 'Named credentials are present. Include an issuer and date where they add useful context.')

  if (!projects.length) add('CAT-PROJECTS', 'suggestion', 'Add relevant projects if they demonstrate skills not already clear from work experience; this category is optional.')
  else if (data.projects.some((entry) => entry.title.trim() && !entry.bullets.some((bullet) => bullet.trim()))) add('CAT-PROJECTS', 'suggestion', 'Add at least one bullet describing your contribution and the project outcome.')
  else add('CAT-PROJECTS', 'passed', 'Project examples are present. Describe your contribution and concrete outcomes.')

  if (!languages.length) add('CAT-LANGUAGES', 'suggestion', 'Add languages and honest proficiency levels if they are relevant to the role. This category is optional.')
  else add('CAT-LANGUAGES', 'passed', 'Language names and proficiency levels are listed.')

  if (!volunteer.length) add('CAT-VOLUNTEER', 'suggestion', 'Add relevant volunteer or community experience if it strengthens your application. This category is optional.')
  else if (data.volunteer.some((entry) => entry.title.trim() && !entry.bullets.some((bullet) => bullet.trim()))) add('CAT-VOLUNTEER', 'suggestion', 'Add a concise bullet about your responsibilities or impact.')
  else add('CAT-VOLUNTEER', 'passed', 'Volunteer entries are present. Focus on relevant responsibilities and outcomes.')

  if (!awards.length) add('CAT-AWARDS', 'suggestion', 'Add relevant awards or recognition if they support your application. This category is optional.')
  else if (data.awards.some((item) => item.name.trim() && !item.issuer.trim() && !item.details.trim())) add('CAT-AWARDS', 'suggestion', 'Add the issuer or a short detail so employers can understand the recognition.')
  else add('CAT-AWARDS', 'passed', 'Awards are named and include context. Keep only recognition relevant to your target role.')

  const standardHeadings = new Set(Object.values(sectionLabels).flatMap((labels) => Object.values(labels).map((label) => label.toLocaleLowerCase())))
  for (const section of data.customSections.filter((item) => item.title.trim())) {
    const standard = standardHeadings.has(section.title.trim().toLocaleLowerCase())
    add(`CAT-CUSTOM-${section.id}`, standard ? 'passed' : 'suggestion', standard
      ? `“${section.title.trim()}” uses a familiar section heading.`
      : `“${section.title.trim()}” is custom. Use a standard heading when it fits, and include only details relevant to the role.`)
  }

  return checks
}

export function getSkillRecommendations(data: ResumeData): SkillRecommendation[] {
  const evidence = [...data.work, ...data.projects, ...data.education, ...data.volunteer]
    .flatMap((entry) => entry.bullets)
    .filter((bullet) => bullet.trim())
    .join(' ')
  return data.skills.filter((skill) => skill.name.trim()).map((skill) => {
    const terms = [skill.name, skill.acronym].filter((term) => term.trim())
    const supported = terms.some((term) => mentionCount(evidence, term) > 0)
    return {
      id: skill.id,
      name: skill.name.trim(),
      group: skill.group.trim() || 'Skills',
      status: supported ? 'passed' : 'suggestion',
      message: supported
        ? 'Evidence appears in a work, project, education, or volunteer bullet.'
        : `Mention “${skill.name.trim()}” naturally in a relevant experience, project, education, or volunteer bullet, if accurate.`,
    }
  })
}
