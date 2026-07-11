# Environment & Test Infrastructure Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a React + TypeScript + Vite project with Vitest and a single passing test, plus lint/typecheck/format tooling and a GitHub Actions CI pipeline — no chess business logic.

**Architecture:** Single npm package at the repo root. Vite builds a static SPA (deployable to Azure Blob / SWA later). Vitest runs on the same Vite config. Source is split into placeholder folders (`engine/`, `llm/`, `ui/`) that mark future module boundaries. CI runs lint → typecheck → test on every push/PR to `main`.

**Tech Stack:** Vite 6, React 18, TypeScript 5, Vitest 3, @testing-library/react 16, jsdom, ESLint 9 (flat config) + typescript-eslint, Prettier 3, GitHub Actions, npm.

## Global Constraints

- Package manager: **npm** (produces `package-lock.json`; CI uses `npm ci`).
- No backend, no business logic in this plan (no chess.js, no LM Studio client).
- `src/engine/`, `src/llm/`, `src/ui/` exist but contain only `.gitkeep` — no logic.
- `src/App.tsx` is an explicitly temporary stub rendering `<h1>LM Chess</h1>`.
- CI Node version: **20.x** (LTS). Local dev may use newer.
- Build output goes to `dist/` (already gitignored).
- All source is TypeScript (`.ts` / `.tsx`), strict mode on.

---

### Task 1: Scaffold project + first green test

Stand up the full toolchain and prove it works with one rendering test. Everything in this task lands together because the passing test is the deliverable that proves the scaffold is correct — config, entry files, and test are not independently meaningful.

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/engine/.gitkeep`, `src/llm/.gitkeep`, `src/ui/.gitkeep`
- Create: `src/vite-env.d.ts`

**Interfaces:**

- Consumes: nothing (first task).
- Produces:
  - npm scripts: `dev`, `build`, `preview`, `test`, `test:watch` (later tasks add `lint`, `typecheck`, `format`).
  - `src/App.tsx` exporting `default function App(): JSX.Element`.
  - Vitest configured with `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lm-chess",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`** (config for Vite's own config file)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`** (build + Vitest config in one file)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

- [ ] **Step 5: Create `src/test/setup.ts`** (registers jest-dom matchers)

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 6: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LM Chess</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/App.tsx`** (temporary stub — replaced in the next spec)

```tsx
export default function App() {
  return <h1>LM Chess</h1>
}
```

- [ ] **Step 9: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 10: Create placeholder folders**

```bash
mkdir -p src/engine src/llm src/ui
touch src/engine/.gitkeep src/llm/.gitkeep src/ui/.gitkeep
```

- [ ] **Step 11: Write the failing test `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app title', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'LM Chess' })).toBeInTheDocument()
})
```

- [ ] **Step 12: Install dependencies**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`, no error output.

- [ ] **Step 13: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `1 passed (1)`, exit code 0. (The test is written against the already-created `App.tsx`; it passes on first run, confirming the whole toolchain resolves, transforms TSX, and renders in jsdom.)

- [ ] **Step 14: Sanity-check the production build**

Run: `npm run build`
Expected: `tsc -b` passes with no type errors, then Vite writes output to `dist/` with no error. Exit code 0.

- [ ] **Step 15: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src .gitignore
git commit -m "chore: scaffold Vite + React + TS project with first green test"
```

---

### Task 2: Lint, format, and typecheck tooling

Add ESLint (flat config), Prettier, and a typecheck script. A reviewer could accept the test scaffold (Task 1) but reject lint rules, so this is its own task.

**Files:**

- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json` (add devDeps + `lint`, `typecheck`, `format`, `format:check` scripts)

**Interfaces:**

- Consumes: `package.json` and source files from Task 1.
- Produces: npm scripts `lint`, `typecheck`, `format`, `format:check` — consumed by Task 3 (CI).

- [ ] **Step 1: Add tooling devDependencies**

Run:

```bash
npm install -D eslint@^9.17.0 @eslint/js@^9.17.0 typescript-eslint@^8.19.0 \
  eslint-plugin-react-hooks@^5.1.0 eslint-plugin-react-refresh@^0.4.16 \
  globals@^15.14.0 prettier@^3.4.2 eslint-config-prettier@^9.1.0
```

Expected: installs without error; `package-lock.json` updated.

- [ ] **Step 2: Create `eslint.config.js`** (flat config)

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  prettier,
)
```

- [ ] **Step 3: Create `.prettierrc.json`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80
}
```

- [ ] **Step 4: Create `.prettierignore`**

```
dist
node_modules
package-lock.json
```

- [ ] **Step 5: Add scripts to `package.json`**

Merge these into the existing `"scripts"` block:

```json
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
```

- [ ] **Step 6: Run typecheck to verify it passes**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 7: Run lint to verify it passes**

Run: `npm run lint`
Expected: no errors, exit code 0. (Fix any reported issues before continuing — the scaffold is small and should be clean.)

- [ ] **Step 8: Run format check**

Run: `npm run format:check`
Expected: `All matched files use Prettier code style!` If it reports issues, run `npm run format` then re-run `format:check` until clean.

- [ ] **Step 9: Commit**

```bash
git add eslint.config.js .prettierrc.json .prettierignore package.json package-lock.json src
git commit -m "chore: add ESLint, Prettier, and typecheck tooling"
```

---

### Task 3: GitHub Actions CI

Wire lint + typecheck + test into CI on every push/PR to `main`.

**Files:**

- Create: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `lint`, `typecheck`, `test` scripts from Tasks 1–2; `package-lock.json` for `npm ci`.
- Produces: a passing CI check on GitHub.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Verify the workflow runs the same steps locally**

Run: `npm ci && npm run lint && npm run typecheck && npm test`
Expected: all four commands succeed in sequence, final exit code 0. (This mirrors exactly what CI will do.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline (lint, typecheck, test)"
```

- [ ] **Step 4: Push and confirm CI is green**

```bash
git push origin main
```

Expected: On GitHub, the "CI" workflow runs on the push and all steps pass (green check). Verify via `gh run list --limit 1` and `gh run watch` (or the GitHub UI). Do not consider the plan complete until CI is observed green.

---

## Self-Review

**Spec coverage:**

- Architecture / folder structure (`src/engine|llm|ui`, root package) → Task 1 (steps 10, and all root config files). ✓
- Stack (Vite, React+TS, Vitest, ESLint, Prettier, npm) → Task 1 (Vite/React/TS/Vitest) + Task 2 (ESLint/Prettier). ✓
- First green test (`App.tsx` stub + `App.test.tsx`, `npm test`) → Task 1 steps 8, 11, 13. ✓
- CI (GitHub Actions: checkout, Node 20, `npm ci`, lint, typecheck, test on push/PR to main) → Task 3. ✓
- Hosting compatibility (static `dist/`) → Task 1 step 14 confirms build produces static output; no deploy step, matching spec's out-of-scope. ✓
- Empty placeholder folders, no business logic → Task 1 step 10 (`.gitkeep` only). ✓
- Known constraint (localhost/CORS) → documentation-only in spec, correctly no task. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows full file contents. ✓

**Type consistency:** `App` is `export default function App()` in Task 1 step 8 and imported identically in step 9 (`main.tsx`) and step 11 (`App.test.tsx`). Script names (`lint`, `typecheck`, `test`) defined in Tasks 1–2 are referenced verbatim in Task 3's CI. `setupFiles` path `./src/test/setup.ts` (step 4) matches the file created in step 5. ✓
