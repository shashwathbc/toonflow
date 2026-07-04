# Toonflow Studio Paint — Claude Code Conventions

## Project Overview
Professional webtoon/manga SaaS platform. Next.js 15 (App Router) + TypeScript strict + Tailwind CSS v3 + Firebase.

## Stack
- **Framework**: Next.js 15 — App Router, `src/` directory, `@/*` alias
- **Language**: TypeScript strict mode
- **Styling**: Tailwind CSS **v3.4.x** — NO v4 syntax (`@theme`, `@utility` are v4 — never use them)
- **UI Primitives**: Radix UI + lucide-react icons
- **State**: Zustand with persist middleware
- **Forms**: react-hook-form + zod resolvers
- **Auth/DB**: Firebase (Auth + Firestore + Storage)
- **Animation**: Framer Motion
- **PWA**: hand-rolled `public/sw.js` + `<PwaRegister />` in root layout (NO next-pwa — removed so builds run on Turbopack)

## File Conventions
- Components: PascalCase (`.tsx`), one per file
- Hooks: camelCase prefixed `use` (`.ts`)
- Utils: camelCase (`.ts`)
- Types: camelCase (`.ts`) in `src/types/`
- All imports use `@/` alias (maps to `src/`)

## Color System — Use Tailwind Classes Only
Never use raw hex in JSX. Use design tokens:
- Backgrounds: `bg-bg`, `bg-bg-card`, `bg-bg-elevated`, `border-bg-border`
- Text: `text-text`, `text-text-secondary`, `text-text-muted`
- Accent: `bg-accent`, `text-accent`, `border-accent`, `text-accent-foreground`
- Danger: `text-danger`, `bg-danger/10`
- Warning: `text-warning`, `bg-warning/10`

## WCAG Accessibility Requirements (All Changes)
- Every interactive element needs `focus-visible:ring-2 focus-visible:ring-accent`
- All images need descriptive `alt` text — never empty alt for meaningful images
- All icon-only buttons need `aria-label`
- Icons used decoratively need `aria-hidden="true"`
- `<main>` elements need `id="main-content"` and `tabIndex={-1}`
- Navigation needs `aria-label` and `role="navigation"`/`role="banner"`
- Form inputs must have `<label htmlFor>` connected to `id`
- Error messages need `role="alert"` or `aria-live="polite"`
- Use `aria-current="page"` on active nav links
- Tab interfaces need `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`
- Minimum color contrast: 4.5:1 for normal text, 3:1 for large text (accent #00C896 on dark bg passes)

## Component Patterns
- `'use client'` required for: hooks, events, browser APIs, useState/useEffect
- Server Components (no directive): data-fetching layouts, static content
- Always use `cn()` from `@/lib/utils/cn` for conditional classes
- Use `<Skeleton>` for loading states, not spinners for content areas

## Auth Pattern
- Use `useAuth()` from `@/hooks/useAuth` — never import Firebase auth directly in components
- Roles: `isAuthenticated`, `isCreator`, `isAdmin`, `isSuperAdmin`
- Super admin email: `shashwathbc@gmail.com` (from `@/lib/utils/constants`)

## Firestore Service Layer
- Never call Firestore directly in components — always use `@/lib/firebase/firestore`
- Use `serverTimestamp()` for `createdAt`/`updatedAt`
- Subcollections: `novels/{id}/chapters`, `webtoons/{id}/episodes`

## Route Groups
- `(main)` — public pages with Navbar + Footer + MobileNav
- `(auth)` — centered login/signup layout, no nav
- `(studio)` — creator tools, studio sidebar, protected by middleware

## Protected Routes
- `/create/**`, `/dashboard/**` → requires auth cookie
- `/admin/**` → requires `role in ['admin', 'superadmin']`
- `/admin/super/**` → requires `email === 'shashwathbc@gmail.com'`

## PWA / Config
- Dev AND build run on Turbopack (`next dev` / `next build`) — never add `--webpack` or webpack-only plugins
- Service worker: `public/sw.js` (hand-written, versioned via `CACHE_VERSION`) registered by `src/components/pwa/PwaRegister.tsx` in production only; in dev it unregisters stale workers
- Icons must exist at `public/icons/` before production build

## After Every Change
- Append a summary to `d:\toonflow\.claude\CHANGES.md`

## DO NOT
- Use Tailwind v4 syntax
- Use Pages Router (`/pages` dir)
- Import Firebase directly in components (use `lib/firebase/*`)
- Use inline styles for values available in Tailwind tokens
- Commit `.env.local`
- Skip `aria-label` on icon-only interactive elements
