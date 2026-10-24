# CV Builder Project Guide

This guide explains how to run, configure, and extend the client-side CV Builder. The project uses React, TypeScript, Vite, Zustand, IndexedDB, a native-text PDF renderer, and a DOCX exporter.

## Requirements and commands

- Install Node.js `22.13` or newer and npm.
- Install project packages with `npm install`.
- Start the development server with `npm run dev` and open the local URL Vite prints.
- Create a strict TypeScript production build with `npm run build`.
- Run the fast Vitest suite with `npm run test:quick`.
- Run the full local suite and dependency audit with `npm run test:full`.
- Re-run the PDF feasibility spike with `npm run spike:pdf`.
- Preview a production build with `npm run preview` after running `npm run build`.

The app is static and client-side. Resume data and an optional processed photo stay in browser IndexedDB. Do not add accounts, cookies, telemetry, remote fonts, server-side storage, or third-party runtime requests. Runtime libraries and styles must be bundled with the app. The Content Security Policy is configured in `index.html` and `public/_headers`.

## Source map

| Path | Responsibility |
| --- | --- |
| `index.html` | App shell, document language, CSP, page title, and global stylesheet entry. |
| `package.json` / `package-lock.json` | Pinned runtime and development packages, Node engine floor, and project commands. Keep both manifests in sync when changing dependencies. |
| `vite.config.ts` | Vite build and development-server configuration. |
| `tsconfig*.json` | Strict TypeScript settings for the app and build tooling. |
| `.nvmrc` | Recommended Node.js version for local development. |
| `.vscode/` | Workspace defaults and editor recommendations for VS Code. |
| `.github/` | Repository automation and contribution workflows. |
| `.gitignore` | Files and generated output Git should leave out of commits. |
| `AGENTS.md` | Repository-specific instructions for coding agents. |
| `README.md` | Project overview and user-facing getting-started information. |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` | Contribution, community, and vulnerability-reporting guidance. |
| `LICENSE` | Project license. Check third-party licenses when adding or copying assets. |
| `public/_headers` | Static-host response headers, including the deployed Content Security Policy. |
| `src/main.tsx` | React application entry point. |
| `src/App.tsx` | Editor navigation, section forms, template and color controls, local persistence, preview, ATS view, and export actions. |
| `src/styles.css` | Shared application styling, responsive layouts, focus styles, and popover placement. |
| `src/coloris.css` | Locally bundled Coloris stylesheet, linked from `index.html` so the development CSP allows it. |
| `src/data/model.ts` | Zod resume schema, defaults, sample content, migration helpers, section labels, and core model types. |
| `src/data/uiText.ts` | Interface strings for reusable controls, keyed by interface locale. The current app is English-first; add translations here when adding localized control text. |
| `src/data/cvText.ts` | CV-language dictionaries and shared date/entry formatting for English and Spanish exports. |
| `src/data/validation.ts` | Contact field validation and URL/phone normalization. |
| `src/data/skillSuggestions.ts` | Curated local skill suggestion data. |
| `src/store/resumeStore.ts` | Zustand state, update, undo/redo, and replacement operations. |
| `src/templates/registry.ts` | Template definitions, layout ordering, legacy template migration, and accent-color parsing/contrast handling. |
| `src/pdf/document.tsx` | Native-text PDF document layout. |
| `src/pdf/generate.ts` | Lazy PDF generation entry point. |
| `src/pdf/preview.ts` | PDF.js rendering and extracted preview text. |
| `src/docx/export.ts` | Native DOCX generation. |
| `src/ats/lint.ts` | ATS checks, explanations, and skill/category recommendations. |
| `src/photo/profilePhoto.ts` and `src/photo/data.ts` | Local photo processing, validation, and conversion. |
| `tests/` | Model, export, PDF extraction, and pagination checks. |
| `docs/ats-spec.md` | ATS requirements and prohibited document structures. |
| `docs/BUILD_PROMPT.md` | Product architecture brief and resolved design decisions. |
| `docs/DECISIONS.md` | Short architecture decision record. |
| `docs/privacy.md` | Local-data and privacy behavior. |
| `scripts/` | PDF asset preparation and the PDF feasibility spike. |
| `public/pdfjs-standard-fonts/` | Locally served PDF.js standard fonts and their licenses. |
| `src/types/` | Local TypeScript declarations for dependencies without suitable bundled types. |

## Editing and adding form fields

1. Add the field to the appropriate Zod object in `src/data/model.ts`. Keep imported data validated and preserve old saves through `migrateResumeInput` or a versioned migration when the schema changes.
2. Update empty and sample resume creation in the same file if the new field needs a default. Keep the sample fictional and editable.
3. Add or update the editor control in `src/App.tsx`. Use real labels, accessible names, visible focus states, inline validation, and existing reusable controls when possible. Put new reusable interface strings in `src/data/uiText.ts`.
4. Trace where the field should appear in the PDF, DOCX, ATS text, JSON backup, and skill/category linting. Update the relevant renderer or lint function rather than adding a preview-only value.
5. Update this guide or the relevant product docs when the field changes project conventions or privacy behavior.
6. Run `npm run build` and the relevant existing checks. Never delete, skip, weaken, or rewrite ATS tests just to make an implementation pass.

Contact validation belongs in `src/data/validation.ts`. Keep normalization and error messages together, then use the shared helpers from the form. Month and year dates are stored as `YYYY-MM`; use the month picker and `formatMonth` in `src/data/cvText.ts` rather than adding free-text dates or day precision.

## Adding or adapting a template

1. Add a declarative template entry in `src/templates/registry.ts`. Give it a distinct hierarchy, typography, spacing, and section order; a palette change alone is not a new layout.
2. Extend the template types only when a new presentation token is needed. Keep section content and business logic shared across templates.
3. Check how the PDF renderer consumes each token in `src/pdf/document.tsx`. The on-screen document preview is rendered from the generated PDF, so it should not receive a separate HTML layout.
4. Keep every generated CV a one-column native-text document. Do not add tables, sidebars, text boxes, floating content, canvas text, or header/footer contact information. Optional photos remain separate from ATS exports and inline in the photo DOCX export.
5. Add or update template IDs in migration logic so old local saves still open. Preserve all resume content when changing templates.
6. Run the pagination and export checks after changing layout tokens. Do not remove ATS assertions if a layout change exposes a failure.

## Color picker and document colors

The main accent is stored in `resume.meta.accentColor`. The Coloris package and stylesheet are bundled locally; do not replace them with a CDN or a runtime fetch. The picker uses the Polaroid theme, automatic light/dark mode, and HEX/RGB/HSL format toggle. `src/templates/registry.ts` parses supported opaque color formats and converts them to a readable HEX accent before PDF/DOCX rendering. Keep alpha disabled so exported colors remain opaque and predictable. The picker is attached to `document.body` so it is not clipped by the scrolling template panel.

## Data, storage, and export behavior

- `src/App.tsx` stores resume JSON under a local IndexedDB key and stores the processed profile photo separately as a Blob.
- Import data must pass through `migrateResumeInput` and `ResumeSchema.safeParse` before replacing editor state.
- PDF and DOCX engines are dynamically imported by export/preview flows to keep them out of the initial editor bundle.
- ATS checks can advise on content but do not block export. Structural rules must remain enforced by the document model and renderer.
- ATS exports omit photos. Photo exports include an in-flow/inline image while retaining a one-column text layout.
- Keep user text as native document text and display visible URLs. Never use a screenshot of the CV as an export.

## Safe change workflow

1. Read `AGENTS.md`, `docs/ats-spec.md`, and `docs/BUILD_PROMPT.md` before changing document behavior.
2. Find the model, editor, renderer, and tests that own the behavior being changed.
3. Keep app UI text in the UI dictionary and CV output text in the CV dictionary; these are separate language concerns.
4. Make the smallest complete change across model, editor, persistence/migration, and exports.
5. Run `npm run build`, then the relevant existing `npm run test:quick` checks for the affected behavior.
6. Inspect the browser at desktop and narrow viewport widths when changing layout or popovers.
7. Review `git diff` for accidental sample data, generated output, remote requests, or changes to ATS rules.

## Project configuration

- To change the product title or browser tab name, update the `<title>` in `index.html`. The brand, editor labels, and editor navigation live in `src/App.tsx`; keep new reusable text in `src/data/uiText.ts` and CV output labels in `src/data/cvText.ts`.
- To change dependencies or commands, edit `package.json` through npm so `package-lock.json` remains synchronized. Keep the Node engine floor compatible with PDF.js.
- To change the development server or build, edit `vite.config.ts`. TypeScript strictness and app/tool boundaries are configured in `tsconfig.app.json` and `tsconfig.node.json`.
- To change production response headers, edit `public/_headers` and keep the CSP aligned with the meta CSP in `index.html`.
- To run in VS Code, open this folder and use `npm run dev`, or serve the project root with Live Server. The app links local files from `src/`; opening `index.html` directly with `file://` does not provide the module server behavior it needs.
- Coloris JavaScript is installed as `@melloware/coloris`; its local CSS copy is `src/coloris.css`. When updating the package, keep the package lock pinned, copy the matching stylesheet, and preserve the HTML `<link>` so strict development CSP settings continue to allow it.
