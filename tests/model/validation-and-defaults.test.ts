import { describe, expect, it } from 'vitest'
import { createEmptyResume, createSampleResume, getDefaultLanguageEntries, migrateResumeInput, ResumeSchema } from '../../src/data/model'
import { emailValidationError, normalizeHttpUrl, phoneValidationError, urlValidationError } from '../../src/data/validation'
import { templates } from '../../src/templates/registry'

describe('contact input validation', () => {
  it('accepts international phone formatting and rejects letters, unmatched parentheses, and overlong numbers', () => {
    expect(phoneValidationError('+58 777 123 4567')).toBe('')
    expect(phoneValidationError('(212) 555-0100')).toBe('')
    expect(phoneValidationError('+44 20 7946 0958')).toBe('')
    expect(phoneValidationError('555-CALL-NOW')).not.toBe('')
    expect(phoneValidationError('(212 555-0100')).not.toBe('')
    expect(phoneValidationError('+1234567890123456')).not.toBe('')
  })

  it('accepts ordinary email addresses without requiring a provider and rejects malformed domains', () => {
    expect(emailValidationError('john.doe@example.com')).toBe('')
    expect(emailValidationError('first+tag@sub.example.org')).toBe('')
    expect(emailValidationError('john@')).not.toBe('')
    expect(emailValidationError('john@example..com')).not.toBe('')
  })

  it('normalizes valid web URLs and rejects non-HTTP schemes', () => {
    expect(normalizeHttpUrl('linkedin.com/in/johndoe')).toBe('https://linkedin.com/in/johndoe')
    expect(urlValidationError('https://example.com/portfolio')).toBe('')
    expect(urlValidationError('example.com:8080/profile')).toBe('')
    expect(urlValidationError('javascript:alert(1)')).not.toBe('')
    expect(urlValidationError('https://example..com')).not.toBe('')
  })
})

describe('CV defaults and migration', () => {
  it('maps the interface locale to an optional native-language suggestion', () => {
    expect(getDefaultLanguageEntries('en-US')[0]).toMatchObject({ name: 'English', level: 'Native', include: false })
    expect(getDefaultLanguageEntries('es-VE')[1]).toMatchObject({ name: 'Spanish', level: 'Native', include: false })
    expect(getDefaultLanguageEntries('fr-FR').every((language) => language.level !== 'Native')).toBe(true)
  })

  it('uses the requested fictional sample profile and migrates legacy template and language fields', () => {
    const sample = createSampleResume('en')
    expect(sample.basics).toMatchObject({ name: 'John Doe', email: 'john.doe@example.com', phone: '+58 777 123 4567', location: 'Caracas, Venezuela' })
    const legacy = createEmptyResume('en') as unknown as Record<string, unknown>
    const meta = { ...(legacy.meta as Record<string, unknown>), templateId: 'classic' }
    const languages = [{ id: 'language-1', name: 'French', level: 'Fluent' }]
    const migrated = ResumeSchema.safeParse(migrateResumeInput({ ...legacy, meta, languages, basics: { ...(legacy.basics as object) } }))
    expect(migrated.success).toBe(true)
    if (migrated.success) {
      expect(migrated.data.meta.templateId).toBe('executive')
      expect(migrated.data.languages[0]?.include).toBe(true)
      expect(migrated.data.basics.links).toEqual([])
    }
  })

  it('offers four distinct template layouts', () => {
    expect(templates.map((template) => template.id)).toEqual(['executive', 'modern-minimal', 'professional', 'technical-ats'])
    expect(new Set(templates.map((template) => template.order)).size).toBe(4)
  })
})
