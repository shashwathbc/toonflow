// Pure running-average update for a 1–5 star rating (audit M3 / H6).
//
// Extracted from the /api/ratings transaction so the aggregation the server
// relies on is unit-testable without Firestore. The route reads the current
// aggregate + the caller's previous rating, calls this, then applies the writes
// the returned `action` describes.
export interface RatingUpdate {
  /** New average, rounded to 1 decimal (0 when there are no ratings). */
  rating: number
  /** New total number of ratings. */
  ratingCount: number
  /** The caller's rating after the action (null = they cleared it). */
  userRating: number | null
  /** Which write the caller's rating doc needs. */
  action: 'added' | 'changed' | 'removed'
}

/**
 * @param currentAvg        the content doc's current average rating
 * @param currentCount      the content doc's current rating count
 * @param previousUserValue the caller's existing rating, or null if none
 * @param newValue          the star the caller just selected (1–5)
 *
 * Re-selecting the same star removes the rating; a new value adds it; a
 * different value changes it. The sum is reconstructed from avg*count.
 */
export function computeRatingUpdate(
  currentAvg: number,
  currentCount: number,
  previousUserValue: number | null,
  newValue: number,
): RatingUpdate {
  const count = Math.max(0, currentCount)
  let sum = currentAvg * count
  let newCount = count
  let userRating: number | null = newValue
  let action: RatingUpdate['action']

  if (previousUserValue != null) {
    if (previousUserValue === newValue) {
      sum -= previousUserValue
      newCount = Math.max(0, count - 1)
      userRating = null
      action = 'removed'
    } else {
      sum += newValue - previousUserValue
      action = 'changed'
    }
  } else {
    sum += newValue
    newCount = count + 1
    action = 'added'
  }

  const rating = newCount > 0 ? Math.round((sum / newCount) * 10) / 10 : 0
  return { rating, ratingCount: newCount, userRating, action }
}
