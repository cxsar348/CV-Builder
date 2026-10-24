# Decisions

## Phase 0

- **Working name:** “CV Builder” follows the current project folder and remains provisional until the owner selects an app name.
- **Scope:** this repository begins with Phase 0 only. Later phases should wait for the owner’s “continue” between phase gates, as requested by the build brief.
- **Runtime:** use pinned React, TypeScript, Vite, `@react-pdf/renderer`, and `pdfjs-dist` versions. The checked-in Node floor is 22.13 because the selected PDF.js release requires it.
- **PDF feasibility:** use Helvetica and Times-Roman with hyphenation disabled; verify extracted text independently with PDF.js and Poppler.
- **Claims:** preserve the supplied ATS specification for traceability, but treat its numerical claims as unverified. Do not repeat them in product copy or the README; describe the app as built to rules and verified by extraction tests.
- **Hosting:** target static Cloudflare Pages with GitHub Pages as a fallback. No remote repository, owner handle, or domain was supplied, so publishing configuration waits until release setup.

## Editor control refinements

- **Accent picker:** use locally bundled Coloris with its Polaroid theme, automatic theme mode, and format toggle. Attach the popup to `document.body` to avoid clipping in the scrollable template panel. Keep alpha disabled; parse HEX, RGB, and HSL into a readable HEX value before rendering exports. Link the local stylesheet from `index.html` because the strict CSP blocks Vite's injected CSS during development.
- **Experience dates:** keep the stored/exported value at `YYYY-MM` and replace browser-specific month inputs with a small accessible month-and-year picker. Do not introduce day-level date precision or free-text dates.
