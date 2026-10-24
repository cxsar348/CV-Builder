import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { del, get, set } from 'idb-keyval'
import Coloris from '@melloware/coloris'
import {
  ArrowDown, ArrowDownToLine, ArrowUp, Award, Briefcase, Check, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleHelp,
  FileDown, FileJson, FileText, FolderOpen, GraduationCap, Heart, ImagePlus, Layers, Languages, Palette, Plus, RotateCcw, RotateCw, Search, ShieldCheck, Sparkles, Trash2, Trophy, User, X,
} from 'lucide-react'
import { atsRuleHelp, getSkillRecommendations, lintResume, type AtsCheck, type SkillRecommendation } from './ats/lint'
import { createEmptyResume, createEntry, createId, createSampleResume, languageProficiencyLevels, migrateResumeInput, ResumeSchema, sanitizeText, sectionLabels, type ResumeData, type ResumeEntry, type SectionKey, type SkillCategory } from './data/model'
import { getSkillSuggestions } from './data/skillSuggestions'
import { emailValidationError, normalizeHttpUrl, normalizePhone, phoneValidationError, urlValidationError } from './data/validation'
import { blobToDataUrl, dataUrlToBlob, isSafePhotoDataUrl, processProfilePhoto } from './photo/profilePhoto'
import { useResumeStore } from './store/resumeStore'
import { getResumeAccent, getTemplateOrder, isResumeColor, templateCategories, templates, type TemplateId } from './templates/registry'
import { formatMonth } from './data/cvText'
import { getUiLocale, uiText } from './data/uiText'

const STORAGE_KEY = 'cv-builder-resume-v1'
const PHOTO_STORAGE_KEY = 'cv-builder-profile-photo-v1'
const supportedCategories: SectionKey[] = ['summary', 'work', 'education', 'skills', 'certificates', 'projects', 'languages', 'volunteer', 'awards']
let colorisBoundInput: HTMLInputElement | null = null
let colorisInitialized = false

function translateLabel(data: ResumeData, key: string) {
  if (key.startsWith('custom:')) return data.customSections.find((section) => section.id === key.slice(7))?.title || 'Custom category'
  return sectionLabels[key as SectionKey]?.[data.meta.cvLanguage] ?? key
}

function sanitizeImported(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeText(value)
  if (Array.isArray(value)) return value.map(sanitizeImported)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeImported(child)]))
  }
  return value
}

function cleanSymbols(data: ResumeData): ResumeData {
  const strip = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replace(/[→✓✔☑☒✅☐➡️🔹🔸⭐]/gu, ' ').replace(/\s{2,}/gu, ' ').trim()
    if (Array.isArray(value)) return value.map(strip)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, strip(child)]))
    return value
  }
  return strip(data) as ResumeData
}

function fileBaseName(name: string) {
  const normalized = name.normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim()
  const firstLast = normalized.split(/\s+/u).filter(Boolean).join('_') || 'CV'
  return `${firstLast}_CV`
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function IconButton({ label, children, onClick, disabled = false, className = '' }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>
}

function TextField({ label, value, onChange, placeholder, type = 'text', required = false, hint, className = '', validate, onValidBlur, autoComplete, inputMode }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; hint?: string; className?: string;
  validate?: (value: string) => string; onValidBlur?: (value: string) => void; autoComplete?: string; inputMode?: 'text' | 'email' | 'tel' | 'url'
}) {
  const id = useId()
  const [error, setError] = useState('')
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}{required && <span className="required-mark"> *</span>}</label>
    <input id={id} type={type} value={value} placeholder={placeholder} required={required} autoComplete={autoComplete} inputMode={inputMode} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} onChange={(event) => onChange(sanitizeText(event.currentTarget.value))} onBlur={(event) => {
      const message = validate?.(event.currentTarget.value) ?? ''
      setError(message)
      if (!message) onValidBlur?.(event.currentTarget.value)
    }} />
    {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}

function TextArea({ label, value, onChange, placeholder, rows = 3, hint }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; hint?: string
}) {
  const id = useId()
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <textarea id={id} value={value} placeholder={placeholder} rows={rows} onChange={(event) => onChange(sanitizeText(event.currentTarget.value))} />
    {hint && <small>{hint}</small>}
  </div>
}

function MonthField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId()
  const dialogId = `${id}-month-picker`
  const locale = getUiLocale()
  const copy = uiText[locale].datePicker
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear())
  const [position, setPosition] = useState<CSSProperties>({})
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const activeMonth = useRef<HTMLButtonElement>(null)
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, index, 1))))

  useLayoutEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      const popup = panel.current?.getBoundingClientRect()
      if (!anchor || !popup) return
      const margin = 12
      const width = Math.min(popup.width || 288, window.innerWidth - margin * 2)
      const height = popup.height
      const below = window.innerHeight - anchor.bottom - margin
      const above = anchor.top - margin
      const top = below >= height || below >= above ? anchor.bottom + 8 : Math.max(margin, anchor.top - height - 8)
      const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin))
      setPosition({ position: 'fixed', top, left, width, zIndex: 1001 })
    }
    updatePosition()
    const closeOutside = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !trigger.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    activeMonth.current?.focus()
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function chooseMonth(monthIndex: number) {
    onChange(`${year}-${String(monthIndex + 1).padStart(2, '0')}`)
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }

  return <div className="field field--month">
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    <button ref={trigger} id={id} className="month-picker-trigger" type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} onClick={() => {
      setYear(Number(value.slice(0, 4)) || new Date().getFullYear())
      setOpen((current) => !current)
    }}>
      <span>{value ? formatMonth(value, locale) : copy.chooseMonth}</span>
      <span className="month-picker-trigger__icon" aria-hidden="true">▦</span>
    </button>
    {open && createPortal(<div ref={panel} className="month-picker" id={dialogId} role="dialog" aria-labelledby={`${id}-label`} style={position}>
      <div className="month-picker__header">
        <button type="button" aria-label={copy.previousYear} onClick={() => setYear((current) => current - 1)}><ChevronLeft size={16} /></button>
        <strong aria-live="polite">{year}</strong>
        <button type="button" aria-label={copy.nextYear} onClick={() => setYear((current) => current + 1)}><ChevronRight size={16} /></button>
      </div>
      <div className="month-picker__grid">
        {months.map((month, index) => {
          const selected = value === `${year}-${String(index + 1).padStart(2, '0')}`
          const focusCurrent = !value && year === new Date().getFullYear() && index === new Date().getMonth()
          return <button key={month} ref={selected || focusCurrent ? activeMonth : undefined} type="button" className={selected ? 'is-selected' : ''} aria-label={copy.selectMonth(month, year)} aria-pressed={selected} onClick={() => chooseMonth(index)}>{month}</button>
        })}
      </div>
    </div>, document.body)}
  </div>
}

function AccentColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const onChangeRef = useRef(onChange)
  const copy = uiText[getUiLocale()].colorPicker
  onChangeRef.current = onChange

  useEffect(() => {
    setDraft(value)
    setError('')
  }, [value])

  useEffect(() => {
    const input = document.getElementById('accent-color')
    if (!(input instanceof HTMLInputElement) || colorisBoundInput === input) return
    if (!colorisInitialized) {
      Coloris.init()
      colorisInitialized = true
    }
    colorisBoundInput = input
    Coloris({
      el: input,
      parent: document.body,
      theme: 'polaroid',
      themeMode: 'auto',
      formatToggle: true,
      alpha: false,
      wrap: false,
      margin: 8,
      onChange: (color, inputEl) => {
        if (inputEl && inputEl !== input) return
        setDraft(color)
        if (isResumeColor(color)) {
          setError('')
          onChangeRef.current(color)
        }
      },
    })
  }, [])

  return <div className="appearance-color__control">
    <input id="accent-color" className="resume-color-input" type="text" value={draft} aria-label="Choose main CV color" aria-invalid={error ? true : undefined} aria-describedby={error ? 'accent-color-error' : 'accent-color-hint'} onChange={(event) => {
      const next = event.currentTarget.value
      setDraft(next)
      if (isResumeColor(next)) {
        setError('')
        onChange(next)
      }
    }} onBlur={() => setError(isResumeColor(draft) ? '' : copy.invalidColor)} />
    <span className="appearance-color__preview" aria-hidden="true" style={{ backgroundColor: isResumeColor(draft) ? draft : '#26364B' }} />
    {error && <small className="field-error" id="accent-color-error" role="alert">{error}</small>}
  </div>
}

function BulletEditor({ bullets, onChange, label = 'Impact bullets' }: { bullets: string[]; onChange: (next: string[]) => void; label?: string }) {
  const current = bullets.length ? bullets : ['']
  const updateBullet = (index: number, value: string) => onChange(current.map((bullet, bulletIndex) => bulletIndex === index ? sanitizeText(value) : bullet))
  return <div className="bullet-editor">
    <div className="subsection-heading"><span>{label}</span><span className="quiet-note">Action + result + number</span></div>
    {current.map((bullet, index) => <div className="bullet-row" key={index}>
      <span className="bullet-dot" aria-hidden="true">•</span>
      <textarea aria-label={`${label}, bullet ${index + 1}`} rows={2} value={bullet} placeholder="Improved a process by 20% using…" onChange={(event) => updateBullet(index, event.currentTarget.value)} />
      <IconButton label={`Remove bullet ${index + 1}`} className="icon-button--quiet" onClick={() => onChange(current.filter((_, bulletIndex) => bulletIndex !== index))} disabled={current.length === 1}><X size={14} /></IconButton>
    </div>)}
    <button className="text-button" type="button" onClick={() => onChange([...current, ''])}><Plus size={15} /> Add bullet</button>
  </div>
}

function EntryEditor({ entries, onAdd, onPatch, onRemove, titleLabel, organizationLabel, addLabel, showGpa = false }: {
  entries: readonly ResumeEntry[]; onAdd: () => void; onPatch: (id: string, patch: Partial<ResumeEntry>) => void; onRemove: (id: string) => void; titleLabel: string; organizationLabel: string; addLabel: string; showGpa?: boolean
}) {
  return <div className="entry-list">
    {entries.map((entry, index) => <article className="entry-card" key={entry.id}>
      <div className="entry-card__head"><span>{entry.title.trim() || `${titleLabel} ${index + 1}`}</span><IconButton label={`Remove entry ${index + 1}`} onClick={() => onRemove(entry.id)} className="icon-button--quiet"><Trash2 size={14} /></IconButton></div>
      <div className="field-grid">
        <TextField label={titleLabel} value={entry.title} onChange={(value) => onPatch(entry.id, { title: value })} placeholder={titleLabel} />
        <TextField label={organizationLabel} value={entry.organization} onChange={(value) => onPatch(entry.id, { organization: value })} placeholder={organizationLabel} />
        <TextField label="Location" value={entry.location} onChange={(value) => onPatch(entry.id, { location: value })} placeholder="City, Country" />
        {showGpa && <TextField label="GPA (optional)" value={('gpa' in entry ? entry.gpa : '') as string} onChange={(value) => onPatch(entry.id, { gpa: value } as Partial<ResumeEntry>)} placeholder="3.8 / 4.0" />}
      </div>
      <div className="date-fields">
        <MonthField label="Start month" value={entry.startDate} onChange={(value) => onPatch(entry.id, { startDate: value })} />
        <MonthField label={entry.present ? 'End month' : 'End month'} value={entry.endDate} disabled={entry.present} onChange={(value) => onPatch(entry.id, { endDate: value })} />
        <label className="checkbox-field"><input type="checkbox" checked={entry.present} onChange={(event) => onPatch(entry.id, { present: event.currentTarget.checked, endDate: event.currentTarget.checked ? '' : entry.endDate })} /> <span>Present</span></label>
      </div>
      <BulletEditor bullets={entry.bullets} onChange={(bullets) => onPatch(entry.id, { bullets })} />
    </article>)}
    <button type="button" className="add-entry-button" onClick={onAdd}><Plus size={16} /> Add {addLabel}</button>
  </div>
}

function TemplateGallery({ selected, name, accentColor, onSelect }: { selected: TemplateId; name: string; accentColor: string; onSelect: (id: TemplateId) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const visibleTemplates = templates.filter((template) => {
    const matchesCategory = category === 'All' || template.category === category
    const search = query.trim().toLocaleLowerCase()
    return matchesCategory && (!search || `${template.name} ${template.description} ${template.category}`.toLocaleLowerCase().includes(search))
  })

  return <div className="template-gallery">
    <label className="template-search"><span className="visually-hidden">Search CV templates</span><input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={`Search ${templates.length} templates`} /></label>
    <div className="template-filters" role="group" aria-label="Filter templates by category">
      {['All', ...templateCategories].map((item) => <button key={item} type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
    </div>
    <div className="template-grid" role="radiogroup" aria-label="CV template">
      {visibleTemplates.map((template) => {
        const sectionLabelsInOrder = getTemplateOrder(template.id).slice(0, 2).map((key) => key === 'work' ? 'EXPERIENCE' : key.toUpperCase())
        const accent = getResumeAccent(template.id, selected === template.id ? accentColor : '')
        const fontFamily = template.fontFamily === 'Times-Roman' ? 'Georgia, serif' : 'Arial, sans-serif'
        return <button type="button" role="radio" aria-checked={selected === template.id} key={template.id} className={`template-card ${selected === template.id ? 'is-selected' : ''}`} onClick={() => onSelect(template.id)}>
          <div className={`template-paper template-paper--${template.previewStyle} template-paper--header-${template.headerRule} template-paper--headline-${template.headlineStyle} template-paper--contact-${template.contactLayout} template-paper--heading-${template.headingStyle}`} aria-hidden="true" style={{ '--template-accent': accent } as CSSProperties}>
            <div className="template-paper__identity">
              <span className="template-paper__name" style={{ color: accent, textAlign: template.nameAlign, fontFamily }}>{name || 'Your name'}</span>
              <span className="template-paper__headline">{template.headlineStyle === 'italic' ? 'Professional focus' : 'Role or professional focus'}</span>
              <span className="template-paper__contact">email · phone · location</span>
            </div>
            {sectionLabelsInOrder.map((label) => <span className="template-paper__heading" style={{ color: accent }} key={label}>{label}</span>)}
            <span className="template-paper__line" />
            <span className="template-paper__line template-paper__line--medium" />
            <span className="template-paper__line" />
            <span className="template-paper__line template-paper__line--short" />
          </div>
          <span className="template-card__name">{template.name}</span>
          <span className="template-card__meta">{template.category}</span>
          <span className="template-card__description">{template.description}</span>
          {selected === template.id && <span className="template-card__selected"><Check size={13} /> Selected</span>}
        </button>
      })}
      {visibleTemplates.length === 0 && <p className="template-empty">No templates match that search.</p>}
    </div>
  </div>
}

function SkillEditor({ skills, categories, onPatch, onRemove, onAddSkill, onAddCategory, onRenameCategory, onMoveCategory, onDeleteCategory }: {
  skills: ResumeData['skills']; categories: SkillCategory[]; onPatch: (id: string, patch: Partial<ResumeData['skills'][number]>) => void; onRemove: (id: string) => void;
  onAddSkill: (name: string, group: string) => void; onAddCategory: (name: string) => void; onRenameCategory: (id: string, name: string) => void;
  onMoveCategory: (id: string, delta: number) => void; onDeleteCategory: (id: string) => void
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [manualSkill, setManualSkill] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [duplicateError, setDuplicateError] = useState('')
  const selected = categories.find((category) => category.id === categoryId) ?? categories[0]
  const visibleSkills = skills.filter((skill) => selected && skill.group.trim().toLocaleLowerCase() === selected.name.trim().toLocaleLowerCase())
  const alreadyAdded = (name: string) => skills.some((skill) => skill.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
  const suggestions = selected ? getSkillSuggestions(selected.name, query).slice(0, 18) : []
  const addManual = () => {
    const name = manualSkill.trim()
    if (!name || !selected || alreadyAdded(name)) return
    onAddSkill(name, selected.name)
    setManualSkill('')
  }
  const addCategory = () => {
    const name = newCategory.trim()
    if (!name) return
    if (categories.some((category) => category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setCategoryError('That category already exists.')
      return
    }
    onAddCategory(name)
    setNewCategory('')
    setCategoryError('')
  }

  return <div className="skill-editor">
    <p className="section-hint">Suggestions are optional examples, not verified qualifications. Select only skills you can support with your experience.</p>
    <div className="skill-category-bar">
      <label className="field"><span>Skill category</span><select value={selected?.id ?? ''} onChange={(event) => setCategoryId(event.currentTarget.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      {selected && <div className="skill-category-actions" aria-label="Manage skill categories">
        <IconButton label={`Move ${selected.name} up`} onClick={() => onMoveCategory(selected.id, -1)} disabled={categories.indexOf(selected) === 0}><ArrowUp size={14} /></IconButton>
        <IconButton label={`Move ${selected.name} down`} onClick={() => onMoveCategory(selected.id, 1)} disabled={categories.indexOf(selected) === categories.length - 1}><ArrowDown size={14} /></IconButton>
        <IconButton label={`Delete ${selected.name} category`} onClick={() => onDeleteCategory(selected.id)} disabled={categories.length <= 1}><Trash2 size={14} /></IconButton>
      </div>}
    </div>
    {selected && <TextField label="Rename category" value={selected.name} onChange={(name) => onRenameCategory(selected.id, name)} placeholder="Category name" />}
    <div className="skill-manage-add">
      <TextField label="New category" value={newCategory} onChange={setNewCategory} placeholder="e.g. Data Analysis" />
      <button className="button button--small" type="button" onClick={addCategory} disabled={!newCategory.trim()}><Plus size={14} /> Add category</button>
    </div>
    {categoryError && <p className="field-error" role="alert">{categoryError}</p>}
    <div className="skill-search-wrap"><Search size={15} aria-hidden="true" /><input aria-label="Search skill suggestions" type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={`Search ${selected?.name ?? 'skills'}`} /></div>
    <div className="skill-suggestions" aria-label={`${selected?.name ?? 'Skill'} suggestions`}>
      {suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={alreadyAdded(suggestion)} onClick={() => selected && onAddSkill(suggestion, selected.name)}>{alreadyAdded(suggestion) ? <Check size={13} /> : <Plus size={13} />}{suggestion}</button>)}
      {!suggestions.length && <span className="quiet-note">No local suggestions match. Add a skill below.</span>}
    </div>
    <div className="skill-manual-add">
      <TextField label={`Add a ${selected?.name ?? 'skill'} not listed above`} value={manualSkill} onChange={setManualSkill} placeholder="Enter a skill" />
      <button className="button button--small" type="button" onClick={addManual} disabled={!manualSkill.trim() || alreadyAdded(manualSkill)}><Plus size={14} /> Add skill</button>
    </div>
    {duplicateError && <p className="field-error" role="status">{duplicateError}</p>}
    {visibleSkills.length ? <div className="selected-skills"><h3>{selected?.name} · {visibleSkills.length} selected</h3>{visibleSkills.map((skill) => <div className="skill-row" key={skill.id}>
      <TextField label="Skill name" value={skill.name} onChange={(value) => {
        const duplicate = value.trim() && skills.some((other) => other.id !== skill.id && other.name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase())
        if (duplicate) { setDuplicateError('That skill is already selected. Choose a different name.'); return }
        setDuplicateError('')
        onPatch(skill.id, { name: value })
      }} placeholder="Project Management" />
      <TextField label="Acronym (optional)" value={skill.acronym} onChange={(value) => onPatch(skill.id, { acronym: value })} placeholder="PMP" />
      <IconButton label={`Remove ${skill.name || 'skill'}`} onClick={() => onRemove(skill.id)} className="icon-button--quiet"><X size={14} /></IconButton>
    </div>)}</div> : <p className="health-empty">No skills selected in this category.</p>}
  </div>
}

function CertificateEditor({ items, onAdd, onPatch, onRemove }: {
  items: ResumeData['certificates']; onAdd: () => void; onPatch: (id: string, patch: Partial<ResumeData['certificates'][number]>) => void; onRemove: (id: string) => void
}) {
  return <div className="entry-list">
    {items.map((item, index) => <article className="entry-card" key={item.id}>
      <div className="entry-card__head"><span>{item.name || `Certification ${index + 1}`}</span><IconButton label={`Remove certification ${index + 1}`} onClick={() => onRemove(item.id)} className="icon-button--quiet"><X size={14} /></IconButton></div>
      <div className="field-grid">
        <TextField label="Certification name" value={item.name} onChange={(value) => onPatch(item.id, { name: value })} placeholder="Project Management Professional" />
        <TextField label="Acronym (optional)" value={item.acronym} onChange={(value) => onPatch(item.id, { acronym: value })} placeholder="PMP" />
        <TextField label="Issuing organization" value={item.issuer} onChange={(value) => onPatch(item.id, { issuer: value })} placeholder="Issuing organization" />
        <MonthField label="Date earned" value={item.date} onChange={(value) => onPatch(item.id, { date: value })} />
        <TextField label="Credential ID (optional)" value={item.credential} onChange={(value) => onPatch(item.id, { credential: value })} placeholder="Credential ID" />
        <TextField label="Credential URL (optional)" value={item.url} onChange={(value) => onPatch(item.id, { url: value })} placeholder="example.com/credential" />
      </div>
    </article>)}
    <button type="button" className="add-entry-button" onClick={onAdd}><Plus size={16} /> Add certification</button>
  </div>
}

function LanguageEditor({ items, onAdd, onPatch, onRemove, language }: {
  items: ResumeData['languages']; onAdd: () => void; onPatch: (id: string, patch: Partial<ResumeData['languages'][number]>) => void; onRemove: (id: string) => void; language: ResumeData['meta']['cvLanguage']
}) {
  const levels = languageProficiencyLevels
  const localLevel: Record<string, string> = language === 'es' ? { Native: 'Nativo', Fluent: 'Fluido', Professional: 'Profesional', Intermediate: 'Intermedio', Conversational: 'Conversacional', Basic: 'Básico' } : {}
  return <div className="entry-list">
    {items.map((item, index) => <div className="language-row" key={item.id}>
      <TextField label={index === 0 ? 'Language' : `Language ${index + 1}`} value={item.name} onChange={(value) => onPatch(item.id, { name: value })} placeholder="Spanish" />
      <div className="field"><label htmlFor={`language-level-${item.id}`}>Proficiency</label><select id={`language-level-${item.id}`} value={item.level} onChange={(event) => onPatch(item.id, { level: event.currentTarget.value as ResumeData['languages'][number]['level'] })}>{levels.map((level) => <option value={level} key={level}>{localLevel[level] ?? level}</option>)}</select></div>
      <label className="checkbox-field language-include"><input type="checkbox" checked={item.include} onChange={(event) => onPatch(item.id, { include: event.currentTarget.checked })} /><span>Include in CV</span></label>
      <IconButton label={`Remove ${item.name || `language ${index + 1}`}`} onClick={() => onRemove(item.id)} className="icon-button--quiet"><X size={14} /></IconButton>
    </div>)}
    <button type="button" className="add-entry-button" onClick={onAdd}><Plus size={16} /> Add language</button>
  </div>
}

function AwardEditor({ items, onAdd, onPatch, onRemove }: {
  items: ResumeData['awards']; onAdd: () => void; onPatch: (id: string, patch: Partial<ResumeData['awards'][number]>) => void; onRemove: (id: string) => void
}) {
  return <div className="entry-list">
    {items.map((item, index) => <article className="entry-card" key={item.id}>
      <div className="entry-card__head"><span>{item.name || `Award ${index + 1}`}</span><IconButton label={`Remove award ${index + 1}`} onClick={() => onRemove(item.id)} className="icon-button--quiet"><X size={14} /></IconButton></div>
      <div className="field-grid"><TextField label="Award name" value={item.name} onChange={(value) => onPatch(item.id, { name: value })} placeholder="Award name" /><TextField label="Issuer" value={item.issuer} onChange={(value) => onPatch(item.id, { issuer: value })} placeholder="Organization" /><MonthField label="Date received" value={item.date} onChange={(value) => onPatch(item.id, { date: value })} /></div>
      <TextArea label="Details (optional)" value={item.details} onChange={(value) => onPatch(item.id, { details: value })} rows={2} placeholder="Why it was awarded" />
    </article>)}
    <button type="button" className="add-entry-button" onClick={onAdd}><Plus size={16} /> Add award</button>
  </div>
}

function RuleHelp({ id }: { id: string }) {
  const description = atsRuleHelp[id] ?? (id.startsWith('CAT-SKILL-')
    ? 'Shows how many selected skills are in this category. Suggestions stay separate from your CV until you explicitly add a skill.'
    : id.startsWith('CAT-CUSTOM-')
      ? 'Checks whether this custom section uses a familiar heading and suggests a standard heading when one fits.'
      : 'Explains the purpose of this ATS rule and the CV information it reviews.')
  return <span className="rule-help-wrap">
    <button type="button" className="rule-help" aria-label={`What ${id} checks`} aria-describedby={`rule-help-${id}`}><strong>{id}</strong><CircleHelp size={13} aria-hidden="true" /></button>
    <span className="rule-tooltip" role="tooltip" id={`rule-help-${id}`}>{description}</span>
  </span>
}

function AtsCheckList({ checks, onCleanSymbols, onUseAtsFirst }: { checks: AtsCheck[]; onCleanSymbols: () => void; onUseAtsFirst: () => void }) {
  return <ul className="health-list">
    {checks.map((check) => <li className={`health-item health-item--${check.status}`} key={check.id}>
      <div className="health-item__top">
        <span className="health-status-icon">{check.status === 'passed' ? <CircleCheck size={15} /> : check.status === 'warning' ? <CircleAlert size={15} /> : <Sparkles size={15} />}</span>
        <RuleHelp id={check.id} />
        <span className="health-status-label">{check.status === 'passed' ? 'Passed' : check.status === 'warning' ? 'Review' : 'Suggestion'}</span>
      </div>
      <p>{check.message}</p>
      {check.id === 'TYP-2' && check.status !== 'passed' && <button className="health-fix" type="button" onClick={onCleanSymbols}>Clean unsupported symbols</button>}
      {check.id === 'DEN-1' && check.status === 'warning' && <button className="health-fix" type="button" onClick={onUseAtsFirst}>Switch to ATS-First template</button>}
    </li>)}
  </ul>
}

function AtsHealth({ checks, skills, onCleanSymbols, onUseAtsFirst }: { checks: AtsCheck[]; skills: SkillRecommendation[]; onCleanSymbols: () => void; onUseAtsFirst: () => void }) {
  const coreChecks = checks.filter((check) => check.group !== 'category')
  const categoryChecks = checks.filter((check) => check.group === 'category')
  const passed = coreChecks.filter((check) => check.status === 'passed').length
  const suggestions = coreChecks.filter((check) => check.status === 'suggestion').length
  const warnings = coreChecks.filter((check) => check.status === 'warning').length
  const supportedSkills = skills.filter((skill) => skill.status === 'passed').length
  return <aside className="health-panel" id="ats-health" aria-labelledby="health-title">
    <div className="panel-heading"><div className="panel-heading__icon"><ShieldCheck size={17} /></div><div><h2 id="health-title">ATS Health</h2><p>Clear, practical checks for your CV.</p></div></div>
    <div className="health-summary"><strong>{passed} ATS rules passed</strong><span>{suggestions} suggestions{warnings ? ` · ${warnings} warnings` : ''}</span></div>
    <AtsCheckList checks={coreChecks} onCleanSymbols={onCleanSymbols} onUseAtsFirst={onUseAtsFirst} />
    <div className="health-details-group">
      <details className="health-details">
        <summary>Category recommendations <span>{categoryChecks.filter((check) => check.status !== 'passed').length} to review</span></summary>
        <AtsCheckList checks={categoryChecks} onCleanSymbols={onCleanSymbols} onUseAtsFirst={onUseAtsFirst} />
      </details>
      <details className="health-details">
        <summary>Skill evidence <span>{supportedSkills} of {skills.length} supported</span></summary>
        {skills.length ? <ul className="skill-recommendations">{skills.map((skill) => <li className={`skill-recommendation skill-recommendation--${skill.status}`} key={skill.id}>
          <div><span className="health-status-icon">{skill.status === 'passed' ? <CircleCheck size={14} /> : <Sparkles size={14} />}</span><strong>{skill.name}</strong><small>{skill.group}</small></div>
          <p>{skill.message}</p>
        </li>)}</ul> : <p className="health-empty">Add a skill to see whether your experience supports it.</p>}
      </details>
    </div>
    <p className="health-footnote">Checks update from your current CV content and selected export layout. They are practical guidance, not a guarantee of how a hiring system will rank a CV.</p>
  </aside>
}

function ExportDialog({ busy, hasPhoto, onClose, onPdfAts, onPdfPhoto, onDocxAts, onDocxPhoto, onJson, checks }: {
  busy: boolean; hasPhoto: boolean; onClose: () => void; onPdfAts: () => void; onPdfPhoto: () => void; onDocxAts: () => void; onDocxPhoto: () => void; onJson: () => void; checks: AtsCheck[]
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="export-dialog__head"><div><p className="eyebrow-small">READY WHEN YOU ARE</p><h2 id="export-title">Export your CV</h2></div><IconButton label="Close export dialog" onClick={onClose}><X size={17} /></IconButton></div>
      <p className="dialog-lede">Your document is generated on this device. Structural checks are enforced; content suggestions never block export.</p>
      <div className="preflight-card"><div className="preflight-card__title"><ShieldCheck size={16} /> Preflight</div><div className="preflight-counts"><span><Check size={14} /> {checks.filter((check) => check.status === 'passed').length} passed</span><span><Sparkles size={14} /> {checks.filter((check) => check.status !== 'passed').length} suggestions</span></div></div>
      <div className="export-options">
        <button type="button" className="export-option" onClick={onPdfAts} disabled={busy}><span className="export-option__icon"><FileText size={19} /></span><span><strong>ATS PDF</strong><small>Text-only, recommended for application portals</small></span><ArrowDownToLine size={16} /></button>
        {hasPhoto && <button type="button" className="export-option" onClick={onPdfPhoto} disabled={busy}><span className="export-option__icon"><ImagePlus size={19} /></span><span><strong>PDF with photo</strong><small>Optional portrait for direct email or print</small></span><ArrowDownToLine size={16} /></button>}
        <button type="button" className="export-option" onClick={onDocxAts} disabled={busy}><span className="export-option__icon"><FileDown size={19} /></span><span><strong>ATS Word document</strong><small>Editable DOCX with one-column text</small></span><ArrowDownToLine size={16} /></button>
        {hasPhoto && <button type="button" className="export-option" onClick={onDocxPhoto} disabled={busy}><span className="export-option__icon"><ImagePlus size={19} /></span><span><strong>Word document with photo</strong><small>Inline photo, no floating or wrapped text</small></span><ArrowDownToLine size={16} /></button>}
        <button type="button" className="export-option" onClick={onJson}><span className="export-option__icon"><FileJson size={19} /></span><span><strong>Backup data</strong><small>Save or move your CV as JSON</small></span><ArrowDownToLine size={16} /></button>
      </div>
      <p className="application-tip"><strong>Application tip</strong> Complete application form questions accurately, including work authorization, licenses, location, and salary expectations.</p>
      {busy && <p className="dialog-status" role="status">Preparing your document…</p>}
    </section>
  </div>
}

export function App() {
  const resume = useResumeStore((state) => state.resume)
  const update = useResumeStore((state) => state.update)
  const replace = useResumeStore((state) => state.replace)
  const hydrate = useResumeStore((state) => state.hydrate)
  const undo = useResumeStore((state) => state.undo)
  const redo = useResumeStore((state) => state.redo)
  const pastCount = useResumeStore((state) => state.past.length)
  const futureCount = useResumeStore((state) => state.future.length)
  const hydrated = useResumeStore((state) => state.hydrated)
  const [saveState, setSaveState] = useState('Loading your CV…')
  const [pdfBusy, setPdfBusy] = useState(true)
  const [pdfError, setPdfError] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [parserText, setParserText] = useState('')
  const [atsView, setAtsView] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [activeEditorSection, setActiveEditorSection] = useState('contact')
  const [selectedNewSection, setSelectedNewSection] = useState('')
  const [importError, setImportError] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [previewWithPhoto, setPreviewWithPhoto] = useState(false)
  const [saveTimestamp, setSaveTimestamp] = useState<number | null>(null)
  const pdfContainer = useRef<HTMLDivElement>(null)
  const pdfBlob = useRef<Blob | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const checks = useMemo(() => lintResume(resume, pdfBusy ? 0 : pageCount, Boolean(photoDataUrl)), [resume, pdfBusy, pageCount, photoDataUrl])
  const skillRecommendations = useMemo(() => getSkillRecommendations(resume), [resume])

  useEffect(() => {
    let cancelled = false
    Promise.all([get<unknown>(STORAGE_KEY), get<unknown>(PHOTO_STORAGE_KEY)]).then(async ([stored, storedPhoto]) => {
      if (cancelled) return
      if (storedPhoto instanceof Blob && storedPhoto.type === 'image/jpeg' && storedPhoto.size <= 150 * 1024) {
        setPhotoDataUrl(await blobToDataUrl(storedPhoto))
      }
      if (stored === undefined) {
        hydrate(createSampleResume(window.document.documentElement.lang || 'en'))
      } else {
        const result = ResumeSchema.safeParse(migrateResumeInput(stored, window.document.documentElement.lang || 'en'))
        if (result.success) hydrate(result.data)
        else {
          hydrate(createEmptyResume(window.document.documentElement.lang || 'en'))
          setImportError('Saved CV data did not match the current format. Import a JSON backup or start a new CV; your previous browser data was left untouched.')
        }
      }
    }).catch(() => {
      if (cancelled) return
      hydrate(createSampleResume(window.document.documentElement.lang || 'en'))
      setImportError('Local storage is unavailable in this browser session. Export a JSON backup to keep your changes.')
    })
    return () => { cancelled = true }
  }, [hydrate])

  useEffect(() => {
    if (!hydrated) return
    setSaveState('Saving on this device…')
    const timer = window.setTimeout(() => {
      set(STORAGE_KEY, resume).then(() => {
        setSaveTimestamp(Date.now())
        setSaveState('Saved on this device')
      }).catch(() => setSaveState('Could not save locally'))
    }, 550)
    return () => window.clearTimeout(timer)
  }, [resume, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      if (!photoDataUrl) {
        void del(PHOTO_STORAGE_KEY).catch(() => setPhotoError('The photo could not be removed from local storage.'))
        return
      }
      void set(PHOTO_STORAGE_KEY, dataUrlToBlob(photoDataUrl)).catch(() => setPhotoError('The photo could not be saved on this device.'))
    } catch {
      setPhotoError('The photo could not be saved on this device.')
    }
  }, [photoDataUrl, hydrated])

  useEffect(() => {
    if (!hydrated || !pdfContainer.current) return
    let cancelled = false
    setPdfBusy(true)
    setPdfError('')
    setPageCount(0)
    setParserText('')
    pdfBlob.current = null
    pdfContainer.current.replaceChildren()
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [{ createResumePdf }, { renderPdfPreview }] = await Promise.all([
            import('./pdf/generate'),
            import('./pdf/preview'),
          ])
          const blob = await createResumePdf(resume, previewWithPhoto ? photoDataUrl : '')
          if (cancelled || !pdfContainer.current) return
          pdfBlob.current = blob
          const result = await renderPdfPreview(new Uint8Array(await blob.arrayBuffer()), pdfContainer.current)
          if (cancelled) return
          setPageCount(result.pageCount)
          setParserText(result.text)
          setPdfBusy(false)
        } catch (error) {
          if (cancelled) return
          setPdfError(error instanceof Error ? error.message : 'The PDF preview could not be created.')
          setPdfBusy(false)
        }
      })()
    }, 420)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [resume, hydrated, photoDataUrl, previewWithPhoto])

  const patchResume = (updater: (current: ResumeData) => ResumeData) => update((current) => updater(current))
  const setMeta = <K extends keyof ResumeData['meta']>(key: K, value: ResumeData['meta'][K]) => patchResume((current) => ({ ...current, meta: { ...current.meta, [key]: value } }))

  function selectTemplate(id: TemplateId) {
    const selectedOrder = getTemplateOrder(id)
    patchResume((current) => {
      const customKeys = current.meta.sectionOrder.filter((key) => key.startsWith('custom:'))
      const otherKeys = current.meta.sectionOrder.filter((key) => !selectedOrder.includes(key) && !customKeys.includes(key))
      return { ...current, meta: { ...current.meta, templateId: id, sectionOrder: [...selectedOrder, ...otherKeys, ...customKeys] } }
    })
  }

  async function importPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoError('')
    try {
      const processed = await processProfilePhoto(file)
      setPhotoDataUrl(await blobToDataUrl(processed))
      setPreviewWithPhoto(true)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The photo could not be prepared.')
    }
  }

  function reorderSection(sectionKey: string, delta: number) {
    patchResume((current) => {
      const order = current.meta.sectionOrder.filter((key) => current.meta.activeSections.includes(key))
      const index = order.indexOf(sectionKey)
      const target = index + delta
      if (index < 0 || target < 0 || target >= order.length) return current
      ;[order[index], order[target]] = [order[target]!, order[index]!]
      return { ...current, meta: { ...current.meta, sectionOrder: [...order, ...current.meta.sectionOrder.filter((key) => !order.includes(key))] } }
    })
  }

  function addCategory(key: string) {
    if (!key) return
    patchResume((current) => {
      const actualKey = key === 'custom' ? `custom:${createId()}` : key
      const customSections = key === 'custom' ? [...current.customSections, { id: actualKey.slice(7), title: '', bullets: [''] }] : current.customSections
      return {
        ...current,
        customSections,
        meta: {
          ...current.meta,
          activeSections: current.meta.activeSections.includes(actualKey) ? current.meta.activeSections : [...current.meta.activeSections, actualKey],
          sectionOrder: current.meta.sectionOrder.includes(actualKey) ? current.meta.sectionOrder : [...current.meta.sectionOrder, actualKey],
        },
      }
    })
    setSelectedNewSection('')
    setActiveEditorSection(key === 'custom' || key.startsWith('custom:') ? 'custom' : key)
  }

  function removeCategory(key: string) {
    const hasContent = key === 'summary' ? Boolean(resume.summary.trim())
      : key === 'skills' ? resume.skills.some((skill) => skill.name.trim())
        : key === 'work' ? resume.work.length > 0
          : key === 'education' ? resume.education.length > 0
            : key === 'projects' ? resume.projects.length > 0
              : key === 'certificates' ? resume.certificates.length > 0
                : key === 'languages' ? resume.languages.some((language) => language.name.trim())
                  : key === 'volunteer' ? resume.volunteer.length > 0
                    : key === 'awards' ? resume.awards.length > 0
                      : false
    if (hasContent && !window.confirm(`Hide ${translateLabel(resume, key)} from this CV? The information will remain saved and can be added back later.`)) return
    patchResume((current) => ({ ...current, meta: { ...current.meta, activeSections: current.meta.activeSections.filter((item) => item !== key) } }))
    if (activeEditorSection === key) setActiveEditorSection('contact')
  }

  function applyPreset(preset: ResumeData['meta']['preset']) {
    const preferred: Record<ResumeData['meta']['preset'], string[]> = {
      experienced: ['summary', 'work', 'skills', 'education', 'certificates', 'projects', 'languages', 'volunteer', 'awards'],
      student: ['education', 'projects', 'skills', 'summary', 'work', 'languages', 'certificates', 'volunteer', 'awards'],
      'career-changer': ['summary', 'skills', 'work', 'projects', 'education', 'certificates', 'languages', 'volunteer', 'awards'],
    }
    patchResume((current) => {
      const customKeys = current.meta.sectionOrder.filter((key) => key.startsWith('custom:'))
      return { ...current, meta: { ...current.meta, preset, sectionOrder: [...preferred[preset], ...customKeys] } }
    })
    if (preset === 'student') setMeta('templateId', 'professional')
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setImportError('')
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const parsedObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
      const importedPhoto = parsedObject?.photoDataUrl ?? ''
      const resumeJson = parsedObject ? Object.fromEntries(Object.entries(parsedObject).filter(([key]) => key !== 'photoDataUrl')) : parsed
      if (importedPhoto && !isSafePhotoDataUrl(importedPhoto)) {
        setImportError('The photo in this backup is not a supported processed JPEG. Your current CV was not changed.')
        return
      }
      const result = ResumeSchema.safeParse(migrateResumeInput(sanitizeImported(resumeJson), window.document.documentElement.lang || 'en'))
      if (!result.success) {
        setImportError('This JSON file does not match a supported CV format. Your current CV was not changed.')
        return
      }
      if (typeof importedPhoto === 'string' && importedPhoto) dataUrlToBlob(importedPhoto)
      replace(result.data)
      setPhotoDataUrl(typeof importedPhoto === 'string' ? importedPhoto : '')
      setPreviewWithPhoto(Boolean(importedPhoto))
      setSaveState('Imported — saving on this device…')
    } catch {
      setImportError('This file could not be read as JSON. Your current CV was not changed.')
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...resume, photoDataUrl }, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${fileBaseName(resume.basics.name)}_${resume.meta.cvLanguage}.json`)
    setShowExport(false)
  }

  async function exportPdfVersion(includePhoto: boolean) {
    setExportBusy(true)
    setExportMessage('')
    try {
      const { createResumePdf } = await import('./pdf/generate')
      const blob = await createResumePdf(resume, includePhoto ? photoDataUrl : '')
      const suffix = includePhoto ? 'photo' : 'ATS'
      downloadBlob(blob, `${fileBaseName(resume.basics.name)}_${suffix}_${resume.meta.cvLanguage}.pdf`)
      setShowExport(false)
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'The PDF could not be prepared.')
    } finally {
      setExportBusy(false)
    }
  }

  async function exportDocxVersion(includePhoto: boolean) {
    setExportBusy(true)
    setExportMessage('')
    try {
      const { createResumeDocx } = await import('./docx/export')
      const blob = await createResumeDocx(resume, includePhoto ? photoDataUrl : '')
      const suffix = includePhoto ? 'photo' : 'ATS'
      downloadBlob(blob, `${fileBaseName(resume.basics.name)}_${suffix}_${resume.meta.cvLanguage}.docx`)
      setShowExport(false)
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'The Word document could not be prepared.')
    } finally {
      setExportBusy(false)
    }
  }

  async function clearAllData() {
    if (!window.confirm('Delete all saved CV data from this device? This cannot be undone.')) return
    await Promise.all([del(STORAGE_KEY), del(PHOTO_STORAGE_KEY)])
    const blank = createEmptyResume(window.document.documentElement.lang || 'en')
    replace(blank)
    setPhotoDataUrl('')
    setPreviewWithPhoto(false)
    setSaveTimestamp(null)
    setImportError('')
    setSaveState('Saved on this device')
  }

  const activeOrder = resume.meta.sectionOrder.filter((key) => resume.meta.activeSections.includes(key))
  const addableSections = supportedCategories.filter((key) => !resume.meta.activeSections.includes(key))

  const updateEntry = (key: 'work' | 'education' | 'projects' | 'volunteer', id: string, patch: Partial<ResumeEntry>) => patchResume((current) => ({ ...current, [key]: current[key].map((entry) => entry.id === id ? { ...entry, ...patch } : entry) }))
  const addEntry = (key: 'work' | 'education' | 'projects' | 'volunteer') => patchResume((current) => ({ ...current, [key]: [...current[key], key === 'education' ? { ...createEntry(), gpa: '' } : createEntry()] }))
  const removeEntry = (key: 'work' | 'education' | 'projects' | 'volunteer', id: string) => patchResume((current) => ({ ...current, [key]: current[key].filter((entry) => entry.id !== id) }))

  function renderSectionBody(key: string) {
    if (key === 'summary') return <TextArea label="A short introduction" value={resume.summary} onChange={(value) => patchResume((current) => ({ ...current, summary: value }))} rows={5} hint={`${resume.summary.length} / 600 characters · 2–4 sentences works well`} placeholder="Summarize your experience, strengths, and the work you want to do." />
    if (key === 'work') return <EntryEditor entries={resume.work} onAdd={() => addEntry('work')} onPatch={(id, patch) => updateEntry('work', id, patch)} onRemove={(id) => removeEntry('work', id)} titleLabel="Job title" organizationLabel="Company" addLabel="experience" />
    if (key === 'education') return <EntryEditor entries={resume.education} onAdd={() => addEntry('education')} onPatch={(id, patch) => updateEntry('education', id, patch)} onRemove={(id) => removeEntry('education', id)} titleLabel="Degree or program" organizationLabel="Institution" addLabel="education" showGpa />
    if (key === 'projects') return <EntryEditor entries={resume.projects} onAdd={() => addEntry('projects')} onPatch={(id, patch) => updateEntry('projects', id, patch)} onRemove={(id) => removeEntry('projects', id)} titleLabel="Project name" organizationLabel="Role or organization" addLabel="project" />
    if (key === 'volunteer') return <EntryEditor entries={resume.volunteer} onAdd={() => addEntry('volunteer')} onPatch={(id, patch) => updateEntry('volunteer', id, patch)} onRemove={(id) => removeEntry('volunteer', id)} titleLabel="Role" organizationLabel="Organization" addLabel="volunteer role" />
    if (key === 'skills') return <SkillEditor
      skills={resume.skills} categories={resume.skillCategories}
      onAddSkill={(name, group) => patchResume((current) => current.skills.some((skill) => skill.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()) ? current : ({ ...current, skills: [...current.skills, { id: createId(), name: name.trim(), acronym: '', group }] }))}
      onPatch={(id, patch) => patchResume((current) => ({ ...current, skills: current.skills.map((item) => item.id === id ? { ...item, ...patch } : item) }))}
      onRemove={(id) => patchResume((current) => ({ ...current, skills: current.skills.filter((item) => item.id !== id) }))}
      onAddCategory={(name) => patchResume((current) => ({ ...current, skillCategories: [...current.skillCategories, { id: createId(), name: name.trim() }] }))}
      onRenameCategory={(id, name) => patchResume((current) => {
        const category = current.skillCategories.find((item) => item.id === id)
        const cleaned = name.trim()
        if (!category || !cleaned || current.skillCategories.some((item) => item.id !== id && item.name.trim().toLocaleLowerCase() === cleaned.toLocaleLowerCase())) return current
        return { ...current, skillCategories: current.skillCategories.map((item) => item.id === id ? { ...item, name: cleaned } : item), skills: current.skills.map((skill) => skill.group === category.name ? { ...skill, group: cleaned } : skill) }
      })}
      onMoveCategory={(id, delta) => patchResume((current) => {
        const categories = [...current.skillCategories]
        const index = categories.findIndex((item) => item.id === id)
        const target = index + delta
        if (index < 0 || target < 0 || target >= categories.length) return current
        ;[categories[index], categories[target]] = [categories[target]!, categories[index]!]
        return { ...current, skillCategories: categories }
      })}
      onDeleteCategory={(id) => patchResume((current) => {
        if (current.skillCategories.length <= 1) return current
        const category = current.skillCategories.find((item) => item.id === id)
        if (!category || !window.confirm(`Delete “${category.name}”? Skills in it will move to another category.`)) return current
        const remaining = current.skillCategories.filter((item) => item.id !== id)
        const destination = remaining[0]!
        return { ...current, skillCategories: remaining, skills: current.skills.map((skill) => skill.group === category.name ? { ...skill, group: destination.name } : skill) }
      })}
    />
    if (key === 'certificates') return <CertificateEditor
      items={resume.certificates}
      onAdd={() => patchResume((current) => ({ ...current, certificates: [...current.certificates, { id: createId(), name: '', acronym: '', issuer: '', date: '', credential: '', url: '' }] }))}
      onPatch={(id, patch) => patchResume((current) => ({ ...current, certificates: current.certificates.map((item) => item.id === id ? { ...item, ...patch } : item) }))}
      onRemove={(id) => patchResume((current) => ({ ...current, certificates: current.certificates.filter((item) => item.id !== id) }))}
    />
    if (key === 'languages') return <LanguageEditor
      items={resume.languages} language={resume.meta.cvLanguage}
      onAdd={() => patchResume((current) => ({ ...current, languages: [...current.languages, { id: createId(), name: '', level: 'Basic', include: true }] }))}
      onPatch={(id, patch) => patchResume((current) => ({ ...current, languages: current.languages.map((item) => item.id === id ? { ...item, ...patch } : item) }))}
      onRemove={(id) => patchResume((current) => ({ ...current, languages: current.languages.filter((item) => item.id !== id) }))}
    />
    if (key === 'awards') return <AwardEditor
      items={resume.awards}
      onAdd={() => patchResume((current) => ({ ...current, awards: [...current.awards, { id: createId(), name: '', issuer: '', date: '', details: '' }] }))}
      onPatch={(id, patch) => patchResume((current) => ({ ...current, awards: current.awards.map((item) => item.id === id ? { ...item, ...patch } : item) }))}
      onRemove={(id) => patchResume((current) => ({ ...current, awards: current.awards.filter((item) => item.id !== id) }))}
    />
    if (key.startsWith('custom:')) {
      const id = key.slice(7)
      const custom = resume.customSections.find((section) => section.id === id)
      if (!custom) return null
      return <div className="custom-editor">
        <TextField label="Category title" value={custom.title} onChange={(value) => patchResume((current) => ({ ...current, customSections: current.customSections.map((section) => section.id === id ? { ...section, title: value } : section) }))} placeholder="Additional Information" hint="Standard headings are easier for many applicant systems to recognize." />
        <BulletEditor bullets={custom.bullets} label="Details" onChange={(bullets) => patchResume((current) => ({ ...current, customSections: current.customSections.map((section) => section.id === id ? { ...section, bullets } : section) }))} />
      </div>
    }
    if (key === 'custom') return <div className="custom-sections-manager">
      <p className="section-hint">Add a focused section for relevant information that does not fit the built-in categories. Sections stay in the same one-column document flow.</p>
      {resume.customSections.map((section, index) => <article className="custom-section-card" key={section.id}>
        <div className="custom-section-card__head"><strong>{section.title.trim() || `Custom section ${index + 1}`}</strong><div className="custom-section-card__actions">
          <IconButton label={`Move ${section.title || `custom section ${index + 1}`} up`} onClick={() => reorderSection(`custom:${section.id}`, -1)} disabled={index === 0}><ArrowUp size={14} /></IconButton>
          <IconButton label={`Move ${section.title || `custom section ${index + 1}`} down`} onClick={() => reorderSection(`custom:${section.id}`, 1)} disabled={index === resume.customSections.length - 1}><ArrowDown size={14} /></IconButton>
          <IconButton label={`Delete ${section.title || `custom section ${index + 1}`} and its content`} onClick={() => {
            const hasContent = Boolean(section.title.trim() || section.bullets.some((bullet) => bullet.trim()))
            if (hasContent && !window.confirm(`Delete “${section.title.trim() || 'this custom section'}” and its content? This cannot be undone.`)) return
            patchResume((current) => ({ ...current, customSections: current.customSections.filter((item) => item.id !== section.id), meta: { ...current.meta, activeSections: current.meta.activeSections.filter((item) => item !== `custom:${section.id}`), sectionOrder: current.meta.sectionOrder.filter((item) => item !== `custom:${section.id}`) } }))
          }}><Trash2 size={14} /></IconButton>
        </div></div>
        <TextField label="Section title" value={section.title} onChange={(value) => patchResume((current) => ({ ...current, customSections: current.customSections.map((item) => item.id === section.id ? { ...item, title: value } : item) }))} placeholder="Additional Information" />
        <BulletEditor bullets={section.bullets} label="Details" onChange={(bullets) => patchResume((current) => ({ ...current, customSections: current.customSections.map((item) => item.id === section.id ? { ...item, bullets } : item) }))} />
      </article>)}
      <button type="button" className="add-entry-button" onClick={() => addCategory('custom')}><Plus size={15} /> Add custom section</button>
    </div>
    return null
  }

  const resumeName = resume.basics.name.trim() || 'Untitled CV'
  const primaryNavigation = [
    { key: 'contact', label: 'Contact Information', icon: <User size={16} aria-hidden="true" /> },
    { key: 'summary', label: 'Professional Summary', icon: <FileText size={16} aria-hidden="true" /> },
    { key: 'skills', label: 'Skills', icon: <Sparkles size={16} aria-hidden="true" /> },
    { key: 'work', label: 'Work Experience', icon: <Briefcase size={16} aria-hidden="true" /> },
    { key: 'education', label: 'Education', icon: <GraduationCap size={16} aria-hidden="true" /> },
    { key: 'projects', label: 'Projects', icon: <FolderOpen size={16} aria-hidden="true" /> },
    { key: 'custom', label: 'Custom Sections', icon: <Layers size={16} aria-hidden="true" /> },
  ]
  const primaryKeys = new Set(primaryNavigation.map((item) => item.key))
  const optionalNavigation = activeOrder.filter((key) => !primaryKeys.has(key) && !key.startsWith('custom:'))
    .map((key) => ({ key, label: translateLabel(resume, key), icon: key === 'languages' ? <Languages size={16} aria-hidden="true" /> : key === 'certificates' ? <Award size={16} aria-hidden="true" /> : key === 'volunteer' ? <Heart size={16} aria-hidden="true" /> : <Trophy size={16} aria-hidden="true" /> }))
  const editorTitle = activeEditorSection === 'contact' ? 'Contact Information'
    : activeEditorSection === 'custom' ? 'Custom Sections'
      : translateLabel(resume, activeEditorSection)
  const sectionCount = (key: string) => key === 'contact' ? (resume.basics.name.trim() && resume.basics.email.trim() && !emailValidationError(resume.basics.email) ? 2 : 0)
    : key === 'summary' ? Number(Boolean(resume.summary.trim()))
      : key === 'skills' ? resume.skills.filter((skill) => skill.name.trim()).length
        : key === 'work' ? resume.work.filter((entry) => entry.title.trim() || entry.organization.trim() || entry.bullets.some((bullet) => bullet.trim())).length
          : key === 'education' ? resume.education.filter((entry) => entry.title.trim() || entry.organization.trim() || entry.bullets.some((bullet) => bullet.trim()) || entry.gpa.trim()).length
            : key === 'projects' ? resume.projects.filter((entry) => entry.title.trim() || entry.organization.trim() || entry.bullets.some((bullet) => bullet.trim())).length
              : key === 'languages' ? resume.languages.filter((item) => item.include && item.name.trim()).length
                : key === 'certificates' ? resume.certificates.filter((item) => item.name.trim()).length
                  : key === 'volunteer' ? resume.volunteer.filter((entry) => entry.title.trim() || entry.organization.trim() || entry.bullets.some((bullet) => bullet.trim())).length
                    : key === 'awards' ? resume.awards.filter((item) => item.name.trim()).length
                      : resume.customSections.filter((section) => section.title.trim() || section.bullets.some((bullet) => bullet.trim())).length
  const openEditorSection = (key: string) => {
    if (key !== 'contact' && key !== 'custom' && !key.startsWith('custom:') && !resume.meta.activeSections.includes(key)) {
      patchResume((current) => ({ ...current, meta: { ...current.meta, activeSections: [...current.meta.activeSections, key], sectionOrder: current.meta.sectionOrder.includes(key) ? current.meta.sectionOrder : [...current.meta.sectionOrder, key] } }))
    }
    setActiveEditorSection(key.startsWith('custom:') ? 'custom' : key)
    setMobileView('edit')
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="CV Builder home"><span className="brand-mark">CV</span><span>Clearline</span></a>
      <div className="document-title"><strong>{resumeName}</strong><span className="save-state" aria-live="polite"><span className={`save-dot ${saveState.includes('Could not') ? 'save-dot--error' : ''}`} />{saveTimestamp ? `${saveState} · ${new Date(saveTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : saveState}</span></div>
      <div className="topbar-controls">
        <label className="select-control"><span>CV language</span><select value={resume.meta.cvLanguage} onChange={(event) => setMeta('cvLanguage', event.currentTarget.value as ResumeData['meta']['cvLanguage'])}><option value="en">English</option><option value="es">Español</option></select></label>
        <label className="select-control select-control--short"><span>Page</span><select value={resume.meta.pageSize} onChange={(event) => setMeta('pageSize', event.currentTarget.value as ResumeData['meta']['pageSize'])}><option value="A4">A4</option><option value="LETTER">Letter</option></select></label>
        <button className="button button--subtle button--undo" type="button" onClick={undo} disabled={!pastCount} aria-label="Undo" title="Undo"><RotateCcw size={15} /></button>
        <button className="button button--subtle button--undo" type="button" onClick={redo} disabled={!futureCount} aria-label="Redo" title="Redo"><RotateCw size={15} /></button>
        <button className="button button--primary" type="button" onClick={() => { setExportMessage(''); setShowExport(true) }}><ArrowDownToLine size={16} /> Export</button>
      </div>
    </header>

    <nav className="mobile-tabs" aria-label="Editor and preview tabs" role="tablist">
      <button type="button" role="tab" aria-selected={mobileView === 'edit'} className={mobileView === 'edit' ? 'is-active' : ''} onClick={() => setMobileView('edit')}>Edit CV</button>
      <button type="button" role="tab" aria-selected={mobileView === 'preview'} className={mobileView === 'preview' ? 'is-active' : ''} onClick={() => setMobileView('preview')}>Preview {pageCount > 0 && <span>{pageCount}</span>}</button>
    </nav>

    <main className="workspace" data-mobile-view={mobileView} id="top">
      <aside className="editor-pane" aria-label="CV editor">
        <div className="editor-heading"><div><p className="eyebrow-small">YOUR DOCUMENT</p><h1>Build your CV</h1></div><span className="private-pill"><ShieldCheck size={13} /> Private</span></div>

        <div className="editor-toolbar">
          <label className="select-control preset-control"><span>Start with a focus</span><select value={resume.meta.preset} onChange={(event) => applyPreset(event.currentTarget.value as ResumeData['meta']['preset'])}><option value="experienced">Experienced</option><option value="student">Student or recent graduate</option><option value="career-changer">Career changer</option></select></label>
          <div className="quick-actions"><button className="text-button" type="button" onClick={() => { replace(createSampleResume(window.document.documentElement.lang || 'en')); setActiveEditorSection('contact'); setPhotoDataUrl(''); setPreviewWithPhoto(false) }}><Sparkles size={14} /> Sample</button><button className="text-button" type="button" onClick={() => { replace(createEmptyResume(window.document.documentElement.lang || 'en')); setActiveEditorSection('contact'); setPhotoDataUrl(''); setPreviewWithPhoto(false) }}>Start blank</button></div>
        </div>

        {importError && <div className="inline-alert" role="alert"><CircleAlert size={16} /><span>{importError}</span><button type="button" aria-label="Dismiss message" onClick={() => setImportError('')}><X size={15} /></button></div>}

        <div className="editor-layout">
          <nav className="editor-navigation" aria-label="CV sections">
            <p className="editor-navigation__label">BUILD YOUR CV</p>
            <div className="section-nav-list">
              {primaryNavigation.map((item) => <button key={item.key} type="button" className={'section-nav-item ' + (activeEditorSection === item.key ? 'is-active' : '')} aria-current={activeEditorSection === item.key ? 'step' : undefined} onClick={() => openEditorSection(item.key)}>
                <span className="section-nav-item__icon">{item.icon}</span><span className="section-nav-item__label">{item.label}</span>
                {sectionCount(item.key) > 0 && <span className="section-nav-item__status"><CircleCheck size={13} aria-hidden="true" /><span className="visually-hidden">Has content</span></span>}
              </button>)}
            </div>
            {optionalNavigation.length > 0 && <>
              <p className="editor-navigation__label editor-navigation__label--more">MORE SECTIONS</p>
              <div className="section-nav-list">
                {optionalNavigation.map((item) => <button key={item.key} type="button" className={'section-nav-item ' + (activeEditorSection === item.key ? 'is-active' : '')} aria-current={activeEditorSection === item.key ? 'step' : undefined} onClick={() => openEditorSection(item.key)}>
                  <span className="section-nav-item__icon">{item.icon}</span><span className="section-nav-item__label">{item.label}</span>
                  {sectionCount(item.key) > 0 && <span className="section-nav-item__status"><CircleCheck size={13} aria-hidden="true" /><span className="visually-hidden">Has content</span></span>}
                </button>)}
              </div>
            </>}
            <div className="add-section-row">
              <label htmlFor="add-category">Add a CV section</label>
              <div className="add-section-controls">
                <select id="add-category" value={selectedNewSection} onChange={(event) => setSelectedNewSection(event.currentTarget.value)}>
                  <option value="">Choose a section…</option>
                  {addableSections.map((key) => <option key={key} value={key}>{sectionLabels[key][resume.meta.cvLanguage]}</option>)}
                  <option value="custom">Custom section</option>
                </select>
                <button className="button button--small" type="button" disabled={!selectedNewSection} onClick={() => addCategory(selectedNewSection)} aria-label="Add selected CV section"><Plus size={15} /></button>
              </div>
            </div>
          </nav>

          <section className="editor-active-panel" aria-labelledby="active-editor-title">
            <div className="editor-active-panel__head">
              <div><p className="eyebrow-small">EDITING</p><h2 id="active-editor-title">{editorTitle}</h2></div>
              {activeEditorSection !== 'contact' && activeEditorSection !== 'custom' && <span className="section-count">{sectionCount(activeEditorSection)}</span>}
            </div>
            <div className="section-card__body">
              {activeEditorSection === 'contact' ? <>
                <p className="section-hint">Add the details you want employers to use. Your name and headline sit at the top of the CV.</p>
                <div className="field-grid">
                  <TextField className="field--identity" label="Full name" autoComplete="name" required value={resume.basics.name} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, name: value } }))} placeholder="Your full name" />
                  <TextField className="field--identity" label="Professional headline" value={resume.basics.headline} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, headline: value } }))} placeholder="Role or professional focus" />
                  <TextField label="Professional email" type="email" inputMode="email" autoComplete="email" required validate={emailValidationError} value={resume.basics.email} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, email: value } }))} placeholder="you@example.com" />
                  <TextField label="Phone number" type="tel" inputMode="tel" autoComplete="tel" validate={phoneValidationError} onValidBlur={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, phone: normalizePhone(value) } }))} value={resume.basics.phone} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, phone: value } }))} placeholder="+1 555 010 1234" hint="International numbers are supported." />
                  <TextField label="City, region, country" autoComplete="address-level2" value={resume.basics.location} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, location: value } }))} placeholder="City, Region, Country" />
                  <TextField label="LinkedIn URL" type="url" inputMode="url" autoComplete="url" validate={urlValidationError} onValidBlur={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, linkedin: normalizeHttpUrl(value) } }))} value={resume.basics.linkedin} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, linkedin: value } }))} placeholder="linkedin.com/in/yourname" />
                  <TextField label="Portfolio or website" type="url" inputMode="url" validate={urlValidationError} onValidBlur={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, website: normalizeHttpUrl(value) } }))} value={resume.basics.website} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, website: value } }))} placeholder="yourportfolio.com" />
                </div>
                <div className="contact-links">
                  <div className="subsection-heading"><span>Additional contact links</span><span className="quiet-note">Optional</span></div>
                  {resume.basics.links.map((link, index) => <div className="contact-link-row" key={link.id}>
                    <TextField label={'Link label ' + (index + 1)} value={link.label} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, links: current.basics.links.map((item) => item.id === link.id ? { ...item, label: value } : item) } }))} placeholder="GitHub" />
                    <TextField label={'URL ' + (index + 1)} type="url" inputMode="url" validate={urlValidationError} onValidBlur={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, links: current.basics.links.map((item) => item.id === link.id ? { ...item, url: normalizeHttpUrl(value) } : item) } }))} value={link.url} onChange={(value) => patchResume((current) => ({ ...current, basics: { ...current.basics, links: current.basics.links.map((item) => item.id === link.id ? { ...item, url: value } : item) } }))} placeholder="github.com/yourname" />
                    <IconButton label={'Remove ' + (link.label || 'contact link')} onClick={() => patchResume((current) => ({ ...current, basics: { ...current.basics, links: current.basics.links.filter((item) => item.id !== link.id) } }))}><X size={14} /></IconButton>
                  </div>)}
                  <button type="button" className="text-button" onClick={() => patchResume((current) => ({ ...current, basics: { ...current.basics, links: [...current.basics.links, { id: createId(), label: '', url: '' }] } }))}><Plus size={14} /> Add contact link</button>
                </div>
              </> : renderSectionBody(activeEditorSection)}
              {activeEditorSection !== 'contact' && activeEditorSection !== 'custom' && <button className="text-button section-hide-button" type="button" onClick={() => removeCategory(activeEditorSection)}>Hide this section from the CV</button>}
            </div>
          </section>
        </div>
        <div className="editor-footer">
          <div className="data-actions">
            <button className="text-button" type="button" onClick={() => fileInput.current?.click()}><FolderOpen size={15} /> Import JSON</button>
            <button className="text-button" type="button" onClick={exportJson}><FileJson size={15} /> Export JSON</button>
            <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { void importJson(event) }} aria-label="Import a CV JSON backup" />
          </div>
          <button className="delete-data-button" type="button" onClick={() => { void clearAllData() }}><Trash2 size={14} /> Delete all my data</button>
        </div>
        <p className="privacy-note">Your CV stays in this browser. Nothing is uploaded.</p>
      </aside>

      <div className="right-pane">
        <section className="preview-panel" aria-labelledby="preview-title">
          <div className="preview-toolbar">
            <div><p className="eyebrow-small">LIVE DOCUMENT</p><h2 id="preview-title">{atsView ? 'ATS text view & analysis' : 'PDF preview'}</h2></div>
            <div className="preview-toolbar__actions">
              <span className="page-count">{pageCount ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : 'Preparing…'}</span>
              {photoDataUrl && <button className={`button button--subtle photo-preview-toggle ${previewWithPhoto ? 'is-active' : ''}`} type="button" aria-pressed={previewWithPhoto} onClick={() => setPreviewWithPhoto((value) => !value)}><ImagePlus size={15} /> {previewWithPhoto ? 'Photo version' : 'ATS version'}</button>}
              <button className={`button button--subtle ats-toggle ${atsView ? 'is-active' : ''}`} type="button" aria-pressed={atsView} onClick={() => setAtsView((value) => !value)}><FileText size={15} /> {atsView ? 'Hide ATS View' : 'Show ATS View'}</button>
            </div>
          </div>
          <div className="paper-stage">
            <div className={`pdf-render-target ${atsView ? 'is-hidden' : ''}`} ref={pdfContainer} aria-label="Rendered PDF pages" />
            {atsView && <pre className="ats-text-view">{parserText || 'The parser text will appear when the PDF preview is ready.'}</pre>}
            {pdfBusy && <div className="preview-loading" role="status"><span className="loading-spinner" /> Updating the PDF preview…</div>}
            {pdfError && <div className="preview-error" role="alert"><CircleAlert size={18} /><strong>Preview could not be created</strong><span>{pdfError}</span><button className="button button--small" type="button" onClick={() => setMeta('templateId', resume.meta.templateId)}>Try again</button></div>}
          </div>
          <div className="preview-foot"><span><span className="status-dot" /> Paper preview is the real PDF</span><span>Single-column layout · text-based export</span></div>
        </section>

        {atsView && <AtsHealth checks={checks} skills={skillRecommendations} onCleanSymbols={() => replace(cleanSymbols(resume))} onUseAtsFirst={() => selectTemplate('technical-ats')} />}
      </div>
    </main>

    <details className="floating-template-switcher">
      <summary><Palette size={16} aria-hidden="true" /><span>Templates & style</span><small>{templates.find((template) => template.id === resume.meta.templateId)?.name ?? 'Choose a layout'}</small></summary>
      <div className="floating-template-switcher__panel">
        <div className="section-block-heading"><div><p className="eyebrow-small">DOCUMENT DESIGN</p><h2>Select a template</h2></div><span className="template-count">{templates.length} distinct layouts</span></div>
        <TemplateGallery selected={resume.meta.templateId} name={resume.basics.name} accentColor={resume.meta.accentColor} onSelect={selectTemplate} />
        <section className="appearance-controls" aria-labelledby="appearance-title">
          <div className="section-block-heading"><div><p className="eyebrow-small">PERSONALIZE</p><h3 id="appearance-title">Color & photo</h3></div></div>
          <div className="appearance-color">
            <div className="appearance-color__swatch"><Palette size={17} /><label htmlFor="accent-color">Main color</label><AccentColorPicker value={resume.meta.accentColor || templates.find((template) => template.id === resume.meta.templateId)?.accent || '#26364B'} onChange={(value) => setMeta('accentColor', value)} /></div>
            <button type="button" className="text-button" onClick={() => setMeta('accentColor', '')}>Use template color</button>
            <p className="section-hint" id="accent-color-hint">Used for the name and section headings. {uiText[getUiLocale()].colorPicker.hint}</p>
          </div>
          <div className="appearance-photo">
            <div className="photo-preview" aria-label={photoDataUrl ? 'Selected profile photo preview' : 'No profile photo selected'}>
              {photoDataUrl ? <img src={photoDataUrl} alt="Profile photo preview" /> : <span><ImagePlus size={19} /> Optional photo</span>}
            </div>
            <div className="photo-actions">
              <input ref={photoInput} className="visually-hidden" type="file" accept="image/jpeg,image/png" onChange={(event) => { void importPhoto(event) }} aria-label="Choose an optional profile photo" />
              <button type="button" className="button button--small" onClick={() => photoInput.current?.click()}><ImagePlus size={15} /> {photoDataUrl ? 'Change photo' : 'Add photo'}</button>
              {photoDataUrl && <button type="button" className="text-button" onClick={() => { setPhotoDataUrl(''); setPreviewWithPhoto(false); setPhotoError('') }}>Remove</button>}
              <p className="section-hint">JPG or PNG · cropped to portrait · stored only on this device.</p>
              <p className="photo-guidance">Photos are optional. ATS exports leave the photo out.</p>
              {photoError && <p className="photo-error" role="alert">{photoError}</p>}
            </div>
          </div>
        </section>
      </div>
    </details>

    {exportMessage && <div className="toast-message" role="status">{exportMessage}<button type="button" onClick={() => setExportMessage('')} aria-label="Dismiss export message"><X size={14} /></button></div>}
    {showExport && <ExportDialog busy={exportBusy} hasPhoto={Boolean(photoDataUrl)} onClose={() => setShowExport(false)} onPdfAts={() => { void exportPdfVersion(false) }} onPdfPhoto={() => { void exportPdfVersion(true) }} onDocxAts={() => { void exportDocxVersion(false) }} onDocxPhoto={() => { void exportDocxVersion(true) }} onJson={exportJson} checks={checks} />}
  </div>
}
