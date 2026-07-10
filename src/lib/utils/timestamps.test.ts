import { describe, it, expect } from 'vitest'
import { tsToSeconds, compareTimestampsDesc, compareTimestampsAsc } from './timestamps'

describe('tsToSeconds', () => {
  it('reads Firestore Timestamp-shaped objects', () => {
    expect(tsToSeconds({ seconds: 1_700_000_000, nanoseconds: 0 })).toBe(1_700_000_000)
  })

  it('converts a JS Date to epoch seconds', () => {
    const d = new Date('2026-07-10T00:00:00.000Z')
    expect(tsToSeconds(d)).toBe(Math.floor(d.getTime() / 1000))
  })

  it('converts epoch millis (number) and ISO string', () => {
    expect(tsToSeconds(2000)).toBe(2) // 2000ms → 2s
    expect(tsToSeconds('2026-07-10T00:00:00.000Z')).toBe(
      Math.floor(new Date('2026-07-10T00:00:00.000Z').getTime() / 1000),
    )
  })

  it('returns 0 for null/undefined/unknown', () => {
    expect(tsToSeconds(null)).toBe(0)
    expect(tsToSeconds(undefined)).toBe(0)
    expect(tsToSeconds({})).toBe(0)
  })
})

describe('timestamp comparators', () => {
  const older = { seconds: 1000, nanoseconds: 0 }
  const newer = { seconds: 2000, nanoseconds: 0 }

  it('sorts newest-first with compareTimestampsDesc', () => {
    const sorted = [older, newer].sort((a, b) => compareTimestampsDesc(a, b))
    expect(sorted[0]).toBe(newer)
  })

  it('sorts oldest-first with compareTimestampsAsc', () => {
    const sorted = [newer, older].sort((a, b) => compareTimestampsAsc(a, b))
    expect(sorted[0]).toBe(older)
  })

  it('treats missing timestamps as epoch 0 (oldest)', () => {
    const sorted = [newer, null].sort((a, b) => compareTimestampsDesc(a, b))
    expect(sorted[0]).toBe(newer)
  })
})
