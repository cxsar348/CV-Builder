# Build Prompt: ATS-Safe, Community-Driven CV Builder

*A prompt for an AI coding agent (Codex, OpenCode, Claude Code) · v1.0 · October 24, 2026*

## 0. How to use this document

1. Create the GitHub repo. Save this file as `docs/BUILD_PROMPT.md` and the ATS spec as `docs/ats-spec.md`.
2. Give the agent this file. It must read both files in full **before writing any code**.
3. Work **one phase at a time** (Section 10). After each phase the agent reports and waits for “continue”.
4. Replace the placeholders `{{APP_NAME}}`, `{{GITHUB_OWNER}}` and `{{DOMAIN}}`.

## 1. Mission and audience

You are a senior full-stack engineer and product designer. Build **{{APP\_NAME}}**: a free, open-source, privacy-first web app that turns CV content a person already has into a clean, **ATS-safe** CV exported as PDF and DOCX. (ATS = Applicant Tracking System, the software many employers use to read and rank CVs.)

- **Users:** the general public: students, first-job seekers, career changers, non-designers. They have the content; they need a simple, trustworthy way to format it.
- **Promise:** a layout that cannot break the ATS rules, plus a built-in view of what a parser reads. Never “100% guaranteed” (see 2.4).
- **Languages:** English first. The Spanish interface is translated at the end (Phase 7), but Spanish CV content (headings, months, accents) is built and tested from Phase 2 because it affects ATS output. Every UI string goes through i18n from day one.
- **Success:** a non-technical user with an existing CV exports a correct PDF in under 10 minutes without reading documentation.

## 2. Non-negotiables

1. **The ATS spec is law.** `docs/ats-spec.md` is the source of truth; Section 4 maps each rule to enforcement. *Enforced* = the app cannot produce a violation. *Linted* = live warning plus a fix; the user may override and still export.
2. **100% client-side.** No backend, accounts, cookies, telemetry or third-party runtime requests (self-host UI fonts). Data stays in the browser; include “Delete all my data”. Strict CSP (a `_headers` file on Cloudflare Pages, meta tag on GitHub Pages), no `dangerouslySetInnerHTML`, schema validation for every imported file.
3. **Native exports only.** PDF with a real text layer and DOCX with valid OpenXML, built from structured data. **Forbidden:** `html2canvas`, `jsPDF.html()`, canvas or SVG-to-PDF for text, LaTeX, headless-browser or server rendering, `window.print()` as the main export.
4. **No unverifiable claims.** The spec’s statistics (“34% of failures”, “100% fidelity”) are unsourced; never show them in the UI or README. Say: “Built to ATS-safe rules and verified by an automated text-extraction test.”
5. **Licensing:** MIT for code, templates and docs; OFL or equivalent for fonts.
6. **Accessibility:** WCAG 2.2 AA, full keyboard use, reduced-motion support.
7. **Deployment:** static build for Cloudflare Pages (custom domain), GitHub Pages as fallback. No Docker required.
8. **Lean dev footprint:** builds and tests on an 8 GB RAM machine: Chromium-only e2e locally (full browser matrix in CI), separate `test:quick` and `test:full` scripts.

## 3. Conflicts already resolved (follow these)

| Topic | Conflict | Decision |
| --- | --- | --- |
| **Profile picture** | The spec demands one column with no frames or text boxes and never mentions photos; common photo layouts (side-by-side header, floating DOCX image) break those rules. | **Opt-in, OFF by default.** In-flow block above the name (left, center or right via a template token), never beside text. DOCX: inline picture with alt text, never floating. Processed locally: crop (3:4 or square), at most 600 px, JPEG up to 150 KB, **EXIF stripped**. Export gives two files from the same data: an **ATS version** (no photo, recommended for online portals) and a **Photo version** (email, print). CI asserts both have an identical text layer. On enabling, show a neutral note: photos are customary in some countries and discouraged in others. |
| **Community templates** | Open contributions versus guaranteed compliance. | **Declarative JSON tokens only**: no HTML, CSS, JS or components. A CI gate renders every template and runs all Section 4 tests (see Section 7). |
| **Fonts** | The spec allows standard system fonts only, yet users need accents. | PDF: base-14 Helvetica (Arial-like) and Times-Roman (Times New Roman-like); WinAnsi covers Western European accents. DOCX: Arial and Times New Roman. Calibri and Georgia only via embedded OFL look-alikes (Carlito, Gelasio) and only if extraction tests pass. Non-Latin scripts are out of scope for v1. |
| **CV language** | Spec headings and dates are English; people write CVs in a language other than their UI language. | **CV language** is a per-document setting, independent of UI language. Localized *standard* headings, month names and “Present” come from one `cv` dictionary (EN and ES from Phase 2). |
| **Skill anchoring (5.3)** | The spec says work-experience bullets; students have few. | Bullets in Work Experience, Projects, Volunteer, Education or Certifications all count. Document this as an extension of the spec. |
| **Section whitelist** | The spec lists five headings; people also need Projects, Languages and more. | Extended whitelist: Projects, Languages, Volunteer Experience, Awards, marked “common in practice, not in the original spec”. |
| **Preview drift** | An HTML preview can differ from the exported PDF. | Preview is the real PDF rendered with pdf.js (debounced about 500 ms; the previous render stays visible). Never build a separate HTML preview. |
| **Friendliness** | “Follow all rules” must not mean “block the user”. | Structural rules are Enforced, content rules are Linted. Linted rules never block export. |

## 4. ATS rules → enforcement

| ID | Spec § | Rule | Enforcement and tests |
| --- | --- | --- | --- |
| FMT-1 | 1.1–1.2 | Native text PDF/DOCX; no raster, canvas or vector-path text | Exporter design. Test: no image XObjects (except the optional photo); extracted text equals expected text. |
| LAY-1 | 2.1 | Single column, no sidebars | IR has no column block. Test: all PDF text sits inside one margin box; only entry-header dates and contact lines may share a baseline; DOCX has one column. |
| LAY-2 | 2.2 | Contact info in the body at the top of page 1; nothing in headers or footers | No header or footer constructs in either renderer. Test: no `header*.xml` or `footer*.xml`; no `fixed` elements in the PDF. |
| LAY-3 | 2.3 | No tables, frames or text boxes | Test on `document.xml`: no `w:tbl`, `w:txbxContent`, `w:framePr`, `wp:anchor`, `mc:AlternateContent`. |
| TYP-1 | 2.3 | Standard fonts only | Font token is an enum. Test: PDF font names are a subset of the allowlist. |
| TYP-2 | 2.3 | Bullet glyph `•` (U+2022); no icons, arrows, check marks or emoji | Renderers hardcode the glyph. Linter flags forbidden symbols in user text with a one-click “Clean”; paste sanitizer strips zero-width and control characters and normalizes odd spaces. |
| HDR-1 | 3.1 | Standard section titles only | Built-in sections use the localized whitelist and cannot be renamed. Custom sections: Linted, suggest the nearest standard title. |
| DAT-1 | 4.1–4.2 | `Month YYYY – Month YYYY` with spaced en dash; month always present; no `03.2022`, `03/04/12` or year-only | Dates are month and year selects, never free text; one formatter; unit tests for EN and ES. |
| KEY-1 | 5.1 | Dual naming at first mention: `Full Name (ACR)` | Skills and certifications have an optional `acronym` field; a community dictionary suggests expansions. Linted: known acronym used without its expansion at first mention. |
| KEY-2 | 5.2 | 2–4 mentions maximum per core skill | Linted: count across the document (acronym and full name count as one skill); warn above 4. |
| KEY-3 | 5.2 | No hidden or white text | Enforced: text colors at least 4.5:1 on white, minimum 10 pt, page background always white (limits are implementation choices). Test: every extracted text item is visible. |
| KEY-4 | 5.3 | Skills anchored in experience | Linted: each skill appears in at least one qualifying bullet (Section 3); the Skills editor shows a per-skill status. |
| DEN-1 | 6.1 | 1–2 pages | Live page counter; Linted: warn above 2 pages. |
| DEN-2 | 6.1 | 8–12 skills | Counter “9 / 12 recommended”; warn above 12; strong warning above 20. |
| DEN-3 | 6.1 | 3–5 bullets per job | Linted: info under 3, warn above 5. |
| BUL-1 | 6.2 | Quantified bullets with digits | Linted: starts with an action verb (EN and ES lists), contains a number, % or currency; spelled-out numbers → suggest digits. Never auto-rewrite. |
| APP-1 | 6.3 | Knockout questions come from application forms | Export modal tip: answer form fields (work authorization, licenses, location, salary expectations) accurately. No percentage claims. |

## 5. Stack and architecture

| Layer | Choice |
| --- | --- |
| App | React, TypeScript (strict), Vite |
| UI | Tailwind CSS, Radix UI primitives, lucide icons (UI only, never in the CV) |
| State and forms | Zustand; react-hook-form with zod; dnd-kit (plus up/down buttons for keyboard use) |
| Storage | IndexedDB via `idb-keyval`; photo stored as a Blob |
| i18n | i18next; namespaces `ui` (interface) and `cv` (headings, months, “Present”, verbs) |
| PDF and DOCX | `@react-pdf/renderer` and `docx` |
| PDF reading | `pdfjs-dist` (preview, ATS View, tests) |
| Tests | Vitest; Playwright and axe; JSZip and mammoth for DOCX; `pdftotext` (poppler) in CI as a second, independent extractor |
| Hygiene | GitHub Actions, Dependabot, `npm audit`, license check |

**Pipeline:** `ResumeData (zod) → buildDocumentModel(data, template, cvLanguage) → IR blocks → PdfRenderer or DocxRenderer`. The IR has only these blocks: `name`, `headline`, `contactLine`, `photo`, `sectionHeading`, `paragraph`, `entryHeader`, `bullet`, `skillLine`. No column, table, frame or free-positioning block exists, so those violations are impossible by construction. Lazy-load the PDF and DOCX engines.

**PDF rules:** base-14 fonts; disable hyphenation (`Font.registerHyphenationCallback(w => [w])`); never use `fixed`, page numbers or headers/footers; keep each heading with the block after it; no letter-spacing; set PDF title, author and language; show URLs as visible text.

**DOCX rules:** one section and no header or footer parts; Word built-in styles (Heading 1 for section titles); bullets via a numbering definition whose text is a literal `•` (U+2022) in Arial, never Word’s Symbol-font default; right-aligned dates with a tab stop, never a table; picture inline only; page size matches the PDF.

**Fallbacks:** if the Phase 0 spike fails, try `pdfmake`, then `pdf-lib` with manual layout. **Never** switch to canvas rendering. Verify every library API against current official docs (training data may be outdated) and pin versions.

## 6. Data model and editor fields

- JSON-Resume-aligned schema (`basics`, `work`, `education`, `skills`, `certificates`, `projects`, `languages`, `volunteer`, `awards`) plus `schemaVersion` and `meta` (CV language, template, page size, preset, section order). Dates are stored as `YYYY-MM` plus a `present` flag. JSON import and export, with a migration function per schema version.
- Sections come from a **registry** (config produces the form, renderer and linter hooks), so adding a section is a config change.

| Section (EN / ES title) | Fields | Hints and limits |
| --- | --- | --- |
| Contact (no title) | Required: full name, email. Optional: headline, phone, city/region/country, LinkedIn, up to 3 other links, photo | Plain text, no icons; URLs shown as visible text |
| Professional Summary / Resumen Profesional | One text area | 2–4 sentences, soft limit about 600 characters |
| Work Experience or Professional Experience / Experiencia Laboral | Required: job title, company, start, end or Present. Optional: location, scope line, bullets | 3–5 bullets recommended |
| Education / Educación | Required: institution, degree or program. Optional: location, start and end or expected, GPA, up to 3 bullets | Month always required |
| Skills / Habilidades | Groups (e.g., Languages, Frameworks, Tools); item = name plus optional acronym | 8–12 total |
| Certifications / Certificaciones | Required: name (plus acronym), issuer. Optional: month and year, credential ID or URL |  |
| Projects / Proyectos (extended) | Required: name. Optional: role, URL, dates, bullets | Key for students |
| Languages / Idiomas (extended) | Language, level (Native, Fluent, Professional, Intermediate, Basic) |  |
| Volunteer Experience / Voluntariado; Awards / Reconocimientos (extended) | Same shape as Experience; awards: name, issuer, date |  |
| Custom section | Title, bullets | Title is Linted (HDR-1) |

Users can add, remove and reorder sections (Contact stays first). **Presets** set the default order and hints: *Experienced*, *Student or recent graduate* (Education first, Projects emphasized), *Career changer* (Summary and Skills emphasized). Plain text only; pasted text is sanitized.

## 7. Template system (community)

Each template lives in `templates/<id>/template.json` and is validated by `schemas/template.schema.json`:

```json
{
  "id": "classic",
  "name": { "en": "Classic", "es": "Clásica" },
  "author": { "name": "Community", "url": "https://github.com/{{GITHUB_OWNER}}" },
  "license": "MIT",
  "version": "1.0.0",
  "tags": ["serif", "one-page", "traditional"],
  "tokens": {
    "page": { "size": "A4", "marginMm": 18 },
    "font": { "family": "serif", "baseSizePt": 10.5, "lineHeight": 1.25 },
    "color": { "text": "#111111", "muted": "#444444", "accent": "#1F3A5F" },
    "name": { "align": "center", "sizePt": 22, "case": "normal" },
    "contact": { "layout": "inline", "separator": "|" },
    "sectionHeading": { "style": "uppercase-rule", "sizePt": 11, "spaceBeforePt": 12 },
    "entry": { "datePlacement": "right", "titleWeight": "bold" },
    "bullets": { "indentMm": 5, "gapPt": 2 },
    "photo": { "placement": "top-center", "widthMm": 28 }
  }
}
```

- **Allowed ranges (schema and CI):** margins 12–25 mm; base size 10–12 pt; line height 1.1–1.5; text, muted and accent colors at least 4.5:1 on white; heading style `bold`, `uppercase`, `rule-below` or `uppercase-rule`; `datePlacement` is `right` or `below`; photo placement `top-left`, `top-center` or `top-right`; fonts from the allowlist; no letter-spacing token.
- **Not allowed:** code, HTML/CSS, images, external URLs, custom fonts, any layout outside the IR.
- **CI gate** (also runs in the app when importing a template): validate the schema, render 5 fixtures (EN, ES with accents, long, student, minimal) in A4 and Letter with and without photo, run every Section 4 test, generate preview thumbnails automatically (contributors never upload images), check the license field.
- **Ship 5 templates:** Classic (serif, centered), Modern (sans, accent color), Compact (dense, one page), Plain (maximum compatibility: dates below, no accent color), Student (education first).
- **Gallery:** cards render live from the user’s own data; filter by tags; author credit; “Submit your template” links to the contribution guide; import and export a template JSON for personal use.
- **Governance:** CODEOWNERS on `/templates`, a PR checklist, and `docs/create-a-template.md` (“a template in 10 minutes”).

## 8. UX and visual design

- **Style (owner brief: “nothing light”):** dark-first, minimalist, friendly: deep neutral background, soft surfaces, one warm accent, generous spacing, rounded corners (about 12 px), calm motion. The CV preview is always a white paper sheet on the dark canvas. AA contrast everywhere. A light-theme toggle is optional and lowest priority.
- **Tone:** plain and encouraging, no jargon; every empty state offers one clear action; errors say what to do next.
- **Desktop:** left = editor with section cards (collapse, reorder, add, remove); right = paper preview with page breaks; top bar = CV name, template, CV language, page size, **ATS Health**, **Export**. **Mobile:** Edit and Preview tabs; touch targets of at least 44 px.
- **Easy to use:** required fields first, optional ones under “More options”; undo/redo; autosave with a visible “Saved on this device”; sample data to explore. Start screen: Start from scratch, Use sample, Import JSON (plus “Import my current CV” in Phase 6).
- **Bullet fields** show live hints: starts with an action verb, includes a number, fits in 1–2 lines.
- **ATS Health panel:** checklist grouped by rule ID, each with a plain explanation and a one-click fix when possible. Show “X checks passed, Y suggestions”, **no numeric score** (false precision invites gaming).
- **ATS View:** a toggle that shows the plain text a parser extracts from the generated PDF (via pdf.js), so users can verify the reading order themselves.
- **Export modal:** preflight summary; PDF and DOCX; photo choice (ATS version, Photo version, or both); filename `Firstname_Lastname_CV_en.pdf`; the APP-1 tip.

## 9. Repository and community

```
.github/   workflows, issue templates (bug, template submission, translation, ATS rule report), PR template, CODEOWNERS, dependabot.yml
docs/      ats-spec.md, BUILD_PROMPT.md, DECISIONS.md, create-a-template.md, privacy.md, glossary.es.md
locales/   ui.en.json, ui.es.json, cv.en.json, cv.es.json
data/      acronyms.en.json, acronyms.es.json, verbs.en.json, verbs.es.json
schemas/  templates/  src/  tests/ (fixtures, ats, e2e)
AGENTS.md  README.md  README.es.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md  LICENSE
```

- `AGENTS.md` holds the commands, a summary of Section 2 and the rule “never weaken ATS tests”.
- “Good first issues” for contributors: translations, acronym and verb dictionaries, new templates.
- SemVer releases with a changelog. Test fixtures use fictional people only.

## 10. Phases and Definition of Done

| Phase | Scope | Gate (must pass before moving on) |
| --- | --- | --- |
| 0 · Foundations and risk spike | Repo, tooling, CI, `AGENTS.md`, docs. Spike: render 3 fixture CVs (EN, ES with accents, long) with `@react-pdf/renderer` using Helvetica and Times; extract with pdf.js **and** poppler | Text order correct, accents intact, no hyphenation, `•` and `–` survive, no image XObjects. If it fails: stop and report options. |
| 1 · Data and editor | Schema, registry-driven forms, persistence, i18n wiring (EN strings, ES stubs), dark theme, presets, sample data, JSON import/export, undo/redo | Core sections editable; reload keeps data; keyboard-only run-through; axe clean |
| 2 · PDF engine and preview | IR, `cv` dictionaries (EN and ES), PdfRenderer, 2 templates, pdf.js preview, ATS View | FMT-1, LAY-1, LAY-2, TYP-1, DAT-1 green |
| 3 · Linter, DOCX, export | All Linted rules, ATS Health panel, DocxRenderer, export modal | Every Section 4 test green for PDF and DOCX |
| 4 · Templates and community | Template schema, gallery, template import/export, CI gate, 5 templates, contribution docs | A deliberately bad template PR is rejected by CI |
| 5 · Photo | Crop, compress, EXIF strip, placement tokens, two-file export | Identical text layer with and without photo; DOCX uses an inline image only; PDF with photo 300 KB or less |
| 6 · Import and polish (can be deferred) | Paste or upload PDF/DOCX into a draft CV (heading detection EN and ES, no AI), multiple CVs and duplicate, offline/PWA, performance and a11y audit | Import never overwrites data without confirmation |
| 7 · Spanish and release | Translate UI, README and docs in a dedicated translation pass using `docs/glossary.es.md` (neutral Latin American Spanish, regional terms flagged); review `cv.es.json` headings; tag v1.0.0 | No missing keys (CI check); ES e2e smoke test; native-speaker review requested via an issue |

**If time is short, cut in this order:** Phase 6, then Phase 5. Never cut Phase 0, the CI gate or the ATS tests.

**v1 Definition of Done:** all Section 4 tests pass for every template × CV language × page size × photo state; no network requests after first load (Playwright asserts it); axe reports no serious or critical issues; Lighthouse at least 90 for performance, accessibility and best practices; READMEs with screenshots; privacy note; 5 templates; contribution docs; deployed on Cloudflare Pages.

## 11. Agent working agreements

- Read both documents in full; record assumptions as short ADRs in `docs/DECISIONS.md`.
- Write ATS tests before the features they protect. **Never weaken, skip or delete an ATS test** to get green. If a rule looks wrong, or two rules conflict, stop and report.
- Verify third-party APIs against current official docs; pin versions; add no dependency that sends data anywhere.
- Use any design, UX or translation skills available in your environment for Phases 1 and 7.
- Ask at most 3 questions, batched, only when blocked; otherwise decide, document and continue.
- Small conventional commits; one PR per phase; no force-pushes.
- Never invent statistics, user counts or testimonials in the UI or docs.
- End each phase with: what was built, test results, screenshots, known issues, proposed next step.

## 12. Out of scope and owner decisions

**Out of scope for v1:** accounts or cloud sync; AI rewriting or LLM calls; job-description keyword matching (roadmap idea, client-side only); right-to-left and CJK scripts; LaTeX or Typst export; cover letters; hosted public CV pages; analytics.

**Owner decisions (the agent uses these defaults until told otherwise):** app name (placeholder) · license MIT · light-theme toggle off · page size defaults from the browser locale · photo OFF by default · “nothing light” read as dark and minimalist (alternative reading: a monochrome, Nothing-OS-style look) · more UI languages only after EN and ES.
