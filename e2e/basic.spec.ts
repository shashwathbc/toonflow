import { test, expect } from '@playwright/test'

/**
 * Basic smoke tests for Toonflow Studio Paint.
 * These verify that core pages render and critical user flows are accessible.
 * More detailed E2E tests should be added for authentication, content creation,
 * reading flows, and payment processing.
 */

test.describe('Home page', () => {
  test('should load the home page with correct title', async ({ page }) => {
    await page.goto('/')

    // Verify the page has loaded with the correct title
    await expect(page).toHaveTitle(/Toonflow Studio Paint/)

    // Verify key elements are visible. Scope to the main navigation landmark —
    // the page has several <nav> elements (navbar, mobile bar, footer groups),
    // so a bare locator('nav') is a strict-mode violation.
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Toonflow/i }).first()).toBeVisible()
  })

  test('should have navigation links', async ({ page }) => {
    await page.goto('/')

    // Check navigation has expected links. Scope to the main navigation so the
    // footer's duplicate "Browse" link doesn't trip strict mode.
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const browseLink = nav.getByRole('link', { name: /browse|explore/i })
    const originalsLink = nav.getByRole('link', { name: /originals/i })

    await expect(browseLink).toBeVisible()
    await expect(originalsLink).toBeVisible()
  })
})

test.describe('Browse page', () => {
  test('should load browse page with content', async ({ page }) => {
    await page.goto('/browse')

    // Browse page should render
    await expect(page).toHaveTitle(/Browse|Toonflow/)

    // The content-type tabs are always rendered and visible on every viewport
    // (the "Open filters" button is md:hidden, so it can't be used on desktop).
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible()
  })
})

test.describe('Legal pages', () => {
  test('should load terms page', async ({ page }) => {
    await page.goto('/terms')
    // Assert the page's specific h1 — the page has many <h2> section headings,
    // so a bare getByRole('heading') matches multiple elements.
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible()
  })

  test('should load privacy page', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  })
})

test.describe('404 page', () => {
  test('should show not-found for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345')
    await expect(page.locator('body')).toContainText(/not.found|404/i)
  })
})

test.describe('Auth pages', () => {
  // Google is the only identity provider — neither page has a credential form.
  test('should load login page with Google as the only option', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
    await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0)
  })

  test('should load signup page with Google as the only option', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('button', { name: /sign up with google/i })).toBeVisible()
    await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0)
  })
})

test.describe('Authentication flow', () => {
  test('unauthenticated user is redirected from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard')
    // Should redirect to /login with redirect param
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected from create to login', async ({ page }) => {
    await page.goto('/create')
    // Should redirect to /login with redirect param
    await expect(page).toHaveURL(/\/login/)
  })
})
