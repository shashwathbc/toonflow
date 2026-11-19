/**
 * Modular product-tour configuration. Add / reorder features here — the engine
 * (components/tour/*) renders whatever is in this array, so new steps need only a
 * `target` (a `[data-tour="…"]` anchor placed on the element) and copy.
 *
 * Targets that can't be reached by a brand-new account (a live reader/editor need
 * real content ids) are intentionally anchored to their ENTRY POINTS on reachable
 * pages (home, /create, /dashboard) and described there — the engine also degrades
 * gracefully to a centered card if an anchor isn't found, so a missing target
 * never breaks the flow.
 */

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TourStep {
  id: string
  kind: 'welcome' | 'spotlight' | 'finish'
  /** Path the overlay navigates to (if not already there) before showing the step. */
  route?: string
  /** Selector of the element to spotlight. Omit for welcome/finish screens. */
  target?: string
  title: string
  body: string
  /** Preferred tooltip side relative to the target (auto-flips to stay on-screen). */
  placement?: TourPlacement
  /** Extra ring padding around the target, in px. */
  padding?: number
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    kind: 'welcome',
    route: '/',
    title: '👋 Welcome to Toonflow Studio Paint!',
    body: 'Create AI-powered Webtoons, Comics and Manga in minutes. Take the 2-minute tour and we’ll show you around.',
  },
  {
    id: 'home',
    kind: 'spotlight',
    route: '/',
    target: '[data-tour="home-feed"]',
    placement: 'top',
    title: 'Your Home feed',
    body: 'Discover trending comics, featured creators, new releases and picks personalized to your taste.',
  },
  {
    id: 'search',
    kind: 'spotlight',
    route: '/',
    target: '[data-tour="nav-search"]',
    placement: 'bottom',
    title: 'Search anything',
    body: 'Instantly find webtoons, creators, genres and stories from the search in the top bar.',
  },
  {
    id: 'read',
    kind: 'spotlight',
    route: '/',
    target: '[data-tour="content-card"]',
    placement: 'right',
    title: 'A distraction-free reader',
    body: 'Open any title for a smooth vertical reader built for webtoons — like, bookmark, comment and jump between chapters as you go.',
  },
  {
    id: 'profile',
    kind: 'spotlight',
    route: '/',
    target: '[data-tour="nav-profile"]',
    placement: 'bottom',
    title: 'Your profile & library',
    body: 'Your account, projects, bookmarks and reading history all live here. Manage followers and creator settings anytime.',
  },
  {
    id: 'create',
    kind: 'spotlight',
    route: '/create',
    target: '[data-tour="create-studios"]',
    placement: 'top',
    title: 'The Creator Studio',
    body: 'This is where you make things. Write serialized novels and build webtoon episodes, then publish them to readers.',
  },
  {
    id: 'publish',
    kind: 'spotlight',
    route: '/create',
    target: '[data-tour="create-studios"]',
    placement: 'bottom',
    title: 'Publish & export anywhere',
    body: 'Publish straight to Toonflow, or export your episode for Webtoon, Tapas, MangaDex and more.',
  },
  {
    id: 'dashboard',
    kind: 'spotlight',
    route: '/dashboard',
    target: '[data-tour="dashboard-analytics"]',
    placement: 'top',
    title: 'Track your growth',
    body: 'Your dashboard shows views, likes, subscribers, revenue and engagement — everything you need to grow.',
  },
  {
    id: 'finish',
    kind: 'finish',
    title: '🎉 You’re ready!',
    body: 'Your creative journey starts now. Make your first AI-powered webtoon, or explore what other creators are making.',
  },
]
