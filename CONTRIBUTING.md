# Contributing to Mailing

First off, thanks for taking the time to contribute!

## Development Setup

1. Fork and clone the repository.
2. Install dependencies with `pnpm install`.
3. Set up your `.env` file by copying `.env.example`. Make sure you generate a strong `ENCRYPTION_KEY`.
4. Initialize the database schema with `pnpm drizzle-kit push`.
5. Run the development server with `pnpm run dev`.

## Code Conventions

- **TypeScript Strict Mode**: All new code must be strictly typed. Avoid `any`.
- **Linting**: We use ESLint. Ensure your code passes `pnpm run lint` before committing.
- **Testing**: We use Vitest for unit testing. Write tests for any new core logic, particularly around encryption and data handling. Run `pnpm run test` to verify.
- **Component Style**: Keep components small and focused. Avoid overengineering. If you are touching Next.js App Router code, favor Server Components by default unless interactivity requires `"use client"`.

## Pull Request Process

1. Create a feature branch from `master` (e.g., `feature/add-new-provider`).
2. Keep your commits clean and descriptive.
3. Push to your fork and submit a PR against the `master` branch.
4. Ensure all CI checks (linting, typechecking, testing) pass.
5. Provide a clear PR description outlining the "why" and "what" of your changes.
