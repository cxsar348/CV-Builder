# Agent guide

## Commands

- `npm run dev` starts the local Vite server.
- `npm run build` performs strict TypeScript checks and creates the static build.
- `npm run test:quick` runs the fast Vitest suite.
- `npm run test:full` runs the quick suite, strict production build, and dependency audit.
- `npm run spike:pdf` reruns the Phase 0 PDF text-extraction spike.

## Non-negotiable product rules

- Keep the app client-side only. Do not add accounts, cookies, telemetry, remote fonts, or third-party runtime requests.
- Preserve the ATS rules in `docs/ats-spec.md` and the resolved enforcement decisions in `docs/BUILD_PROMPT.md`.
- Never weaken, skip, or delete an ATS test to make a change pass. If a rule conflicts with an implementation, stop and document the conflict.
- Generated CVs must remain one-column native text documents. Do not add tables, sidebars, floating text, canvas text, or header/footer content.
- Structural rules are enforced by construction. Content rules are linted and may show suggestions without blocking export.
- Do not repeat unverified statistics from the input spec in the app or README.

## Project conventions

- TypeScript strict mode is enabled.
- Keep UI strings in i18n dictionaries as Phase 1 introduces them.
- Use standard accessible controls and preserve keyboard operation.
- Keep export dependencies lazy-loaded when the editor is implemented.
