# Tests

Unit and integration tests for AI Prompt Pro, powered by [Vitest](https://vitest.dev/) with `jsdom` and [Testing Library](https://testing-library.com/).

## Running tests

```sh
npm test              # run all suites once
npm run test:watch    # watch mode
npm run test:unit     # unit tests only (excludes RLS integration)
npm run test:rls      # RLS integration tests (requires NEON_SERVICE_ROLE_KEY)
```

Run a single file:

```sh
npx vitest run src/test/persistence.test.ts
```

Run by test name:

```sh
npx vitest run -t "saves draft to localStorage"
```

## Setup

Global test setup lives in `src/test/setup.ts` (jsdom environment, Testing Library matchers).

## Conventions

- Test files: `{module}.test.ts(x)` in this directory.
- Add regression tests for changes to prompt composition, persistence, auth, and RLS.
- Mobile UX changes also need Playwright checks in `playwright/`.
