// Browser half of POST /api/views/reconcile.
//
// A work's `viewCount` is the running sum of its chapters'/episodes' views, kept
// in step by the /api/views transaction. Deleting a part breaks that identity —
// the child's views vanish with it while the parent keeps them — so the detail
// page's total would stay permanently above the sum of the chapters listed
// underneath it. Clients cannot write viewCount (Firestore rules deny it, by
// design), so the repair is a server recomputation.
//
// Best-effort on purpose: the delete itself has already succeeded and must not
// appear to fail because a follow-up correction didn't land. A missed
// reconciliation leaves the old (too high) total, exactly the behaviour before
// this existed, and the next delete fixes it.

export type ReconcilableContent = 'novel' | 'webtoon'

export async function reconcileViewCount(
  contentType: ReconcilableContent,
  contentId: string,
): Promise<void> {
  // Relative URL — only meaningful in the browser. The delete helpers that call
  // this run from studio components, but the guard keeps any future server-side
  // caller from throwing on an unresolvable URL.
  if (typeof window === 'undefined') return

  try {
    await fetch('/api/views/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType, contentId }),
    })
  } catch {
    /* see above — never let a totals correction break a delete */
  }
}
