import { describe, it, expect } from 'vitest'
import { computeRatingUpdate } from './ratingMath'

describe('computeRatingUpdate', () => {
  it('adds the first rating', () => {
    const r = computeRatingUpdate(0, 0, null, 5)
    expect(r).toEqual({ rating: 5, ratingCount: 1, userRating: 5, action: 'added' })
  })

  it('adds a rating to an existing average', () => {
    // one existing 4-star; add a 2-star → avg (4+2)/2 = 3.0, count 2
    const r = computeRatingUpdate(4, 1, null, 2)
    expect(r.action).toBe('added')
    expect(r.ratingCount).toBe(2)
    expect(r.rating).toBe(3)
    expect(r.userRating).toBe(2)
  })

  it('changes an existing rating without moving the count', () => {
    // avg 4 over 2 ratings (sum 8); caller had 4, changes to 2 → sum 6 → 3.0
    const r = computeRatingUpdate(4, 2, 4, 2)
    expect(r.action).toBe('changed')
    expect(r.ratingCount).toBe(2)
    expect(r.rating).toBe(3)
    expect(r.userRating).toBe(2)
  })

  it('removes a rating when the same star is re-selected', () => {
    // avg 4 over 2 (sum 8); caller had 4, re-selects 4 → sum 4, count 1 → 4.0
    const r = computeRatingUpdate(4, 2, 4, 4)
    expect(r.action).toBe('removed')
    expect(r.ratingCount).toBe(1)
    expect(r.rating).toBe(4)
    expect(r.userRating).toBeNull()
  })

  it('drops the average to 0 when the last rating is removed', () => {
    const r = computeRatingUpdate(5, 1, 5, 5)
    expect(r).toEqual({ rating: 0, ratingCount: 0, userRating: null, action: 'removed' })
  })

  it('rounds the average to one decimal', () => {
    // three ratings 5,5,4 (sum 14, avg 4.666…) → 4.7
    const r = computeRatingUpdate(5, 2, null, 4) // avg 5 over 2 = sum 10, add 4 → 14/3
    expect(r.rating).toBe(4.7)
  })

  it('never returns a negative count', () => {
    const r = computeRatingUpdate(0, 0, 3, 3)
    expect(r.ratingCount).toBe(0)
  })
})
