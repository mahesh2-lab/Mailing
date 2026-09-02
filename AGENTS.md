<!-- BEGIN:nextjs-agent-rules -->

# AGENT.md — Next.js Development Rules

This file defines how code must be written in this Next.js project. Follow these rules strictly on every task — feature, fix, or refactor. Written from the standpoint of a senior (6+ yrs) Next.js engineer who values simplicity, readability, and maintainability over cleverness.

---

## 1. Core Philosophy

- **Simple > Clever.** If a junior dev can't understand the code in 30 seconds, it's too complex.
- **Boring code is good code.** Don't reach for a design pattern, abstraction, or library when a plain function will do.
- **Solve the problem that exists, not the one you imagine.** No speculative generalization ("just in case we need it later").
- **YAGNI (You Aren't Gonna Need It).** Don't build config systems, plugin architectures, or generic utils for a single use case.
- **Optimize for deletion.** Code should be easy to remove/replace, not just easy to add to.

---

## 2. No Overengineering

- Do NOT introduce a new abstraction (HOC, factory, generic wrapper, custom hook) unless the same logic is repeated **3+ times**.
- Do NOT create a new folder/module structure for a feature that fits in one file.
- Do NOT add a state management library (Redux, Zustand, Jotai) for state that can live in `useState`/`useReducer` or URL params.
- Do NOT wrap simple fetch calls in unnecessary layers (repository → service → controller → hook) for a basic CRUD call. One clean `lib/api/*.ts` function + a hook is enough.
- Before adding a dependency, ask: "Can this be done in <20 lines of native code?" If yes, don't add the dependency.
- No premature performance optimization (`useMemo`, `useCallback`, `React.memo`) unless there's a measured, real performance issue. Don't sprinkle them everywhere "just to be safe."

---

## 3. Component Rules

### 3.1 Size & Responsibility
- One component = one responsibility. If a component does data fetching + business logic + heavy rendering + form handling, split it.
- A component file should generally stay **under ~150–200 lines**. If it's growing past that, extract sub-components or hooks.
- Split by **concern**, not by arbitrary line count. Don't over-split into 10 tiny components that only exist to satisfy a line limit — that itself is overengineering.

### 3.2 Component Hierarchy
- Avoid deep component nesting for the sake of "structure." A feature should not need 5 layers of wrapper components that just pass data down.
- Max recommended nesting for a feature: `Page → Feature Component → 1–2 child components`. If you're going deeper, re-think the design.
- Don't create a folder-per-component with `index.tsx`, `styles.ts`, `types.ts`, `hooks.ts`, `utils.ts` for a component that's 30 lines long. Keep small components in a single file.

### 3.3 No Props Drilling
- If a prop is passed through **3+ levels** just to reach a deeply nested child, STOP. Use one of:
  - **React Context** (for small-to-medium shared state — theme, auth, user session)
  - **Component composition** (pass `children` instead of drilling data + JSX config)
  - **Colocate state** closer to where it's actually used, instead of lifting it too high
- Don't create global state for something only 2 sibling components need — lift state to their common parent instead.
- Don't overuse Context either — Context is not a replacement for well-designed composition. Use the simplest tool that solves the actual drilling problem.

---

## 4. Clean Code Rules

### 4.1 No Nested Conditionals
- **Max 1 level of nested `if`.** If you need more, refactor using:
  - Early returns / guard clauses
  - Extracting the condition into a named function (`isEligibleForDiscount(user)` instead of inline boolean logic)
  - Switch statements or lookup objects/maps for multi-branch logic instead of `if/else if/else if...`
- Bad:
  ```ts
  if (user) {
    if (user.isActive) {
      if (user.role === 'admin') {
        // ...
      }
    }
  }
  ```
- Good:
  ```ts
  if (!user || !user.isActive) return null;
  if (user.role !== 'admin') return null;
  // ...
  ```

### 4.2 Function Rules
- One function does one thing. If the function name has "and" in it (`fetchUserAndFormatAndSave`), split it.
- Keep functions short — if you need to scroll to read one function, it's doing too much.
- Prefer pure functions. Side effects (API calls, mutations) should be isolated and explicit, not buried inside deeply nested logic.
- Avoid boolean-flag parameters that change function behavior (`doThing(true)`); prefer separate named functions or explicit option objects.

### 4.3 Naming
- Names must be descriptive and unambiguous: `isLoading`, `handleSubmit`, `getUserById` — not `flag`, `data2`, `temp`, `doStuff`.
- Booleans read like yes/no questions: `isOpen`, `hasError`, `canSubmit`.
- No abbreviations that aren't universally understood (`btn`, `usr`, `cfg` — avoid).

### 4.4 No Duplicate Logic
- If the same logic appears twice, extract it into a shared function/hook. Not before that (avoid premature DRY-ing after just one occurrence).
- Shared logic goes in `lib/`, `utils/`, or `hooks/` — never copy-pasted across components.

---

## 5. Next.js Specific Rules

### 5.1 App Router Conventions
- Use **Server Components by default**. Only add `"use client"` when the component actually needs interactivity, state, or browser APIs.
- Don't mark an entire page `"use client"` just because one small child needs interactivity — push `"use client"` down to the smallest possible leaf component.
- Fetch data on the server (in Server Components / route handlers) rather than client-side `useEffect` fetching, unless the data is genuinely client-driven (e.g., depends on user interaction after load).

### 5.2 File & Folder Structure
- Follow Next.js route conventions strictly: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Group by **feature**, not by type, for anything beyond trivial size:
  ```
  /app
    /dashboard
      page.tsx
      /components
        DashboardCard.tsx
      /hooks
        useDashboardData.ts
  ```
- Don't create a global `/components` dump folder for everything. Feature-specific components live near their feature. Only truly shared/reusable UI (buttons, inputs, modals) goes in a shared `/components/ui` folder.
- Don't create unnecessary index barrel files (`index.ts` re-exporting everything) unless the folder is a genuinely public shared module.

### 5.3 Data Fetching
- Use built-in `fetch` with Next.js caching (`cache`, `revalidate`) instead of manually reinventing caching logic.
- Don't wrap every API call in a heavy abstraction layer (e.g. full repository pattern) for a small app. A simple typed fetch function is enough.
- Co-locate server actions with the feature that uses them; don't dump all server actions into one giant `actions.ts` file.

### 5.4 State Management
- Local UI state → `useState`.
- Derived state → compute directly during render, don't store it in state.
- Cross-page/shared state → React Context (lightweight) or URL search params (shareable, bookmarkable state) before reaching for a library.
- Server data → let Next.js caching / React Query (if already in the project) handle it. Don't duplicate server data into client state unnecessarily.

### 5.5 Styling
- Keep styling co-located and simple (Tailwind classes inline, or CSS Modules). Don't build a custom theming abstraction unless the project genuinely needs multi-theme support.
- No inline complex conditional class logic with nested ternaries — use a small `clsx`/`cn` utility instead.

### 5.6 TypeScript
- Type everything meaningfully. No `any` unless absolutely unavoidable (and if used, comment why).
- Prefer explicit, narrow types over generic catch-alls.
- Don't create deeply generic reusable types for a one-off case — inline the type if it's used once.

---

## 6. Error Handling
- Handle errors where they occur — don't let errors silently swallow or bubble up through five layers unhandled.
- Use `error.tsx` / `try-catch` at the right boundary, not everywhere defensively "just in case."
- Don't wrap every single line in try-catch. Catch at meaningful boundaries (API calls, form submissions, server actions).

---

## 7. Review Checklist (Before Committing Code)

- [ ] Could this be simpler? (Remove any abstraction not justified by real repetition/complexity)
- [ ] Any nested `if` beyond 1 level? → Refactor with guard clauses.
- [ ] Any prop passed through 3+ components? → Fix with composition/Context.
- [ ] Any component doing more than one job? → Split.
- [ ] Any `"use client"` that could be removed or pushed further down?
- [ ] Any duplicated logic that should be extracted (but only if repeated 3+ times)?
- [ ] Are names self-explanatory without needing a comment?
- [ ] Is there a dependency added that wasn't strictly necessary?

---

## 8. Golden Rule

> **If you're not sure whether something is overengineered, it probably is.**
> Write the dumbest, most obvious solution that correctly solves today's problem — not tomorrow's imagined one.

<!-- END:nextjs-agent-rules -->
