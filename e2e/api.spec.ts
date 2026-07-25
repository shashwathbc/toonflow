import { test, expect } from '@playwright/test'

/**
 * API smoke tests for public endpoints.
 * These verify that the API routes respond with the expected status codes.
 * Detailed integration tests should be added for each API route.
 *
 * Note: Authenticated routes (creator analytics, etc.) require a valid session
 * cookie and are tested in the auth-flow E2E tests.
 */

test.describe('Public API endpoints', () => {
  test('support endpoint rejects invalid JSON', async ({ request }) => {
    const response = await request.post('/api/support', {
      data: { invalid: true },
    })
    // Should get 400 for invalid input (missing required fields)
    expect(response.status()).toBe(400)
  })

  test('views endpoint rejects invalid phase', async ({ request }) => {
    const response = await request.post('/api/views', {
      data: { phase: 'invalid' },
      headers: {
        'Content-Type': 'application/json',
        // Must match the base URL host for the isSameOrigin() check
        Origin: 'http://localhost:3000',
      },
    })
    // isSameOrigin passes → handler returns 400 (unknown phase)
    expect(response.status()).toBe(400)
  })

  test('views endpoint requires valid content type', async ({ request }) => {
    const response = await request.post('/api/views', {
      data: { phase: 'begin', contentType: 'invalid', contentId: 'test', parentId: 'test' },
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
    })
    expect(response.status()).toBe(400)
  })

  test('session endpoint rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/session', {
      data: { idToken: 'fake-token' },
    })
    // Should fail auth
    expect(response.status()).toBe(401)
  })
})

test.describe('Static resources', () => {
  test('robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
  })

  test('sitemap.xml is accessible', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
  })

  test('manifest.json is accessible', async ({ request }) => {
    const response = await request.get('/manifest.json')
    expect(response.status()).toBe(200)
  })
})
