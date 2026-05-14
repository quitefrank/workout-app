---
project: workout-app
type: planning
status: ready-for-handoff
created: 2026-05-13
updated: 2026-05-13
---

# Workout App

Planning and Claude Code handoff for rebuilding the Notion workout database as a personal PWA.

## State

Planning is complete and the project is ready for Claude Code to scaffold.

## Stack

Next.js 16 with React 19 on Vercel. Supabase Postgres for data and auth. PWA via `@ducanh2912/next-pwa`. Tailwind 4. TanStack Query. Sonner. Vitest. bun. Mirrors the Plately conventions so both personal apps share patterns.

## Files

| File | What's in it |
|---|---|
| `planning.md` | Notion audit, scope decisions, full data model, migration approach, screen-by-screen V1 spec |
| `handoff-prompt.md` | The literal prompt to paste into Claude Code as the opening message |

## Project Location

Code lives at `Personal/projects/workout-app/`. Single tracked codebase, `main` on GitHub, feature branches off it. No `v1/` subfolder.

## Next Move

1. Read `planning.md` end to end.
2. Create the project directory at `Personal/projects/workout-app/`.
3. Initialize the GitHub repo before opening Claude Code so the first commit lands cleanly.
4. Open it in Claude Code and paste `handoff-prompt.md` as the first message.
5. Milestone 1 covers scaffold, Supabase schema, and the Notion seed script (library, programs, and populated historical sessions). No screens yet.

## Out of This Round

Native iOS, Apple Watch, HealthKit sync, custom program builder in-app, alternates suggester UI, social features, food logging, body weight tracking, native shell. All deferred to V2 or later.
