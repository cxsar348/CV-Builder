# Contributing

Thanks for helping build a simple CV tool that keeps people’s data on their own devices.

## Before contributing

- Read `docs/BUILD_PROMPT.md` and `docs/ats-spec.md`.
- Keep all CV output in a single linear column and use native text for exports.
- Never weaken ATS checks. Add or update the relevant check before adding a feature it protects.
- Do not include real personal information in fixtures; use fictional examples only.

## Local checks

```sh
npm ci
npm run test:quick
npm run build
```

## Early contribution areas

Translation, template tokens, and ATS rule reports will be opened for community contributions after their corresponding phases are implemented.
