# Clearline — ATS-friendly CV Builder

A privacy-first CV editor that runs entirely in your browser. Clearline keeps your resume on
your own device, previews it as a real PDF, checks it against applicant-tracking-system (ATS)
rules, and exports native-text **PDF**, **DOCX**, and **JSON** files.

No account. No server-side storage. No telemetry.

> **Status: `v0.1.0` — working editor, not a preview.** Editing, autosave, ATS checks, and all
> three exports are implemented and covered by tests. See [What is and is not built](#what-is-and-is-not-built).

---

## Why this exists

Most CV templates look good and parse badly. Multi-column layouts, text boxes, and icon fonts
turn into scrambled text when an ATS reads them. Clearline takes the opposite approach: every
template is a single top-to-bottom column of real text, and the app tells you when content
would trip a parser — before you send the file.

## Features

**Editor**

- Structured sections: summary, work experience, education, skills, certifications, projects,
  languages, volunteer experience, awards — plus custom categories.
- Reorder sections, add or remove entries, and add impact bullets per role.
- Undo and redo across edits; autosave to IndexedDB (`cv-builder-resume-v1`).
- Start from a blank CV or a sample profile.
- Bilingual UI and CV output (English / Spanish), including section headings and date formats.
- Optional portrait photo: cropped and recompressed **locally**, stored as a Blob
  (`cv-builder-profile-photo-v1`), and **excluded from the ATS PDF/DOCX exports**. Secondary
  "photo" versions are available for printing or sending directly.

**Templates**

Four single-column templates, each a different information hierarchy:

| Template | Emphasis |
|---|---|
| `professional` | Balanced, conventional layout |
| `modern-minimal` | Tight typography, restrained spacing |
| `executive` | Seniority and achievements first |
| `technical-ats` | Maximum parser safety, minimal styling |

Accent colour is configurable; light colours are darkened automatically to keep printed
headings readable.

**ATS checks** — 31 documented rules across layout, formatting, contact data, keyword usage,
density, bullet quality, and per-category review. Two kinds, deliberately separated:

- **Structural rules** (one column, real text, contact details in the body, no tables/floating
  text) are enforced *by construction* — the exporters cannot produce a violating document.
- **Content rules** (unsupported symbols, abbreviations, date completeness, skill density,
  bullets with action + result, page count) are **linted as suggestions** and never block export.

You can clean unsupported symbols with one click.

**Export and import**

- PDF via `@react-pdf/renderer` (selectable text, no rasterised pages), A4 or US Letter.
- DOCX via `docx`.
- JSON — a validated, portable backup that can be re-imported to continue editing.

## What is and is not built

Built and working today: the editor described above, 4 templates, live PDF preview, ATS checks,
PDF/DOCX/JSON export, JSON import, local autosave, EN/ES output.

Not built yet: multi-template gallery beyond the four listed, cloud sync or accounts (by design),
and any server component. The README, `docs/`, and the code are the authority — if a feature is
not in the list above, assume it is not there.

## Privacy by design

- Everything runs client-side; there is no backend and no API call at runtime.
- The production build ships a strict Content-Security-Policy in `public/_headers`:
  `default-src 'self'`, `connect-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'none'`, no third-party scripts, fonts, or analytics.
- Resume data lives in IndexedDB on the device. **Delete all** clears the stored resume and
  photo from the browser.
- Nothing leaves the machine unless you export a file yourself.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript 7 (strict) |
| Build | Vite 8 |
| State | Zustand (undo/redo history) |
| Persistence | `idb-keyval` (IndexedDB) |
| PDF | `@react-pdf/renderer` + `pdfjs-dist` for preview and page counting |
| DOCX | `docx` |
| Validation | Zod |
| Colour input | `@melloware/coloris` |
| Icons | `lucide-react` |

## Getting started

Requires **Node.js 22.13 or newer** (see `.nvmrc`).

```sh
npm ci
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173/>). This is the recommended workflow:
Vite compiles the React/TypeScript source on the fly.

### Static build / Live Server

VS Code Live Server can only serve compiled files:

```sh
npm run build      # type-check + bundle into dist/
```

Then set Live Server's root to `dist/` and open `dist/index.html` → **Go Live**. Rebuild after
source changes.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (copies pdf.js assets first) |
| `npm run build` | Strict `tsc -b` type-check, then `vite build` into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test:quick` | Vitest suite (ATS rules, export structure, validation) |
| `npm run test:full` | Tests + strict build + `npm audit --audit-level=high` |
| `npm run spike:pdf` | Re-runs the PDF text-extraction spike (`scripts/pdf-spike.tsx`) |

## Project structure

```
src/
  App.tsx                 editor UI, preview, export wiring
  ats/lint.ts             31 ATS rules + suggestions
  data/model.ts           resume schema, defaults, sanitisation
  data/validation.ts      email / phone / URL validation
  data/uiText.ts          EN/ES interface strings
  data/cvText.ts          CV-side headings, dates, labels
  templates/registry.ts   template metadata and ordering
  pdf/document.tsx        PDF document definition
  pdf/generate.ts         PDF rendering
  pdf/preview.ts          preview rendering + page count
  docx/export.ts          DOCX generation
  photo/profilePhoto.ts   local crop / recompress / Blob handling
  store/resumeStore.ts    Zustand store with undo/redo
docs/                     ATS spec, build prompt, decision log, privacy
tests/                    Vitest suites (ATS, exports, model, pagination)
scripts/                  pdf.js asset copy, PDF spike
public/                   static assets, pdf.js fonts, security headers
```

## Verifying a change

```sh
npm run test:quick     # 12 tests across 4 suites
npm run build          # strict types + production bundle
```

CI (`.github/workflows/ci.yml`) runs the same three steps on every push and pull request:
`npm ci` → `test:quick` → `build` → `npm audit --audit-level=high`.

## Deployment

The build is a static bundle in `dist/`. Any static host works (GitHub Pages, Cloudflare Pages,
Netlify). Deploy the contents of `dist/`, and keep `public/_headers` in place on hosts that
support header files so the CSP and `X-Frame-Options: DENY` are applied.

## Documentation

- [ATS specification](docs/ats-spec.md) — what each rule checks and why
- [Build prompt](docs/BUILD_PROMPT.md) — product constraints and resolved decisions
- [Decision log](docs/DECISIONS.md) — why the architecture looks like this
- [Privacy notes](docs/privacy.md)
- [Project guide](PROJECT_GUIDE.md) — longer walkthrough of the codebase

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). For
security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

Two rules matter more than style:

1. **Never weaken, skip, or delete an ATS test to make a change pass.** If a rule conflicts with
   an implementation, document the conflict and stop.
2. **Keep the app client-side only** — no accounts, cookies, telemetry, remote fonts, or
   third-party runtime requests.

## License

[MIT](LICENSE) © 2026 CV Builder contributors

## Disclaimer

ATS behaviour differs between vendors and changes over time. Clearline enforces structural
safety and flags common content problems; it cannot guarantee a particular parsing result or
hiring outcome.
