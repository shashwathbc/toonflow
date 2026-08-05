// Global, cross-instance guard for the AI generation surface — a platform-wide
// safety cap and an instant kill switch that the per-user hourly limiter
// (aiRateLimit) structurally cannot provide.
//
// WHY a second layer: aiRateLimited bounds ONE account's rate. It can't bound
// TOTAL platform spend, and because AI generation is free to users while every
// call spends real vendor money (Anthropic + the image provider), a spike — a
// viral moment, a swarm of fresh accounts, a runaway agent loop — can still run
// the bill up even with per-user caps in place. This module adds:
//   1. AI_GENERATION_DISABLED — an instant, config-only kill switch (no deploy).
//   2. A GLOBAL daily generation ceiling per kind, counted in Firestore so it
//      holds across every autoscaled instance (unlike the in-memory limiter).
//
// The counter is one document per UTC day (aiUsage/{YYYY-MM-DD}), written with
// the Admin SDK (bypasses Firestore rules; no client can read or forge it). At
// extreme sustained throughput a single doc approaches Firestore's ~1 write/sec
// soft limit — swap in a sharded counter then. Normal operation stays well under
// it because the daily cap itself bounds the average write rate.
import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/serverApp'

export type AiSpendKind = 'image' | 'text'

// Generous defaults so the cap only trips on genuinely abnormal volume. Tune to
// your funded budget via AI_DAILY_IMAGE_CAP / AI_DAILY_TEXT_CAP.
const DEFAULT_DAILY_CAP: Record<AiSpendKind, number> = {
  image: 20_000,
  text: 40_000,
}

function dailyCap(kind: AiSpendKind): number {
  const raw = kind === 'image' ? process.env.AI_DAILY_IMAGE_CAP : process.env.AI_DAILY_TEXT_CAP
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_CAP[kind]
}

function isKilled(): boolean {
  const v = process.env.AI_GENERATION_DISABLED
  return v === '1' || v === 'true' || v === 'yes'
}

/** UTC day key (YYYY-MM-DD) — the counter resets at UTC midnight. */
function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

const disabledResponse = () =>
  NextResponse.json(
    { error: 'AI generation is temporarily paused. Please try again later.' },
    { status: 503 },
  )

const capResponse = () =>
  NextResponse.json(
    { error: "The platform's AI generation limit for today has been reached. Please try again tomorrow." },
    { status: 429 },
  )

/**
 * Enforce the global kill switch + daily generation ceiling for `kind`. Returns a
 * ready-to-return NextResponse when generation must be BLOCKED, otherwise null
 * (proceed) after recording one unit of usage. Call AFTER verifiedUid and the
 * per-user aiRateLimited check, and BEFORE contacting the vendor.
 *
 * Fails OPEN on an unexpected Firestore error (this is a spend guard, not the
 * primary auth gate) — except the kill switch, which always wins. Pair the cap
 * with spend alerting so a tripped ceiling is noticed, not silently absorbed.
 */
export async function enforceGlobalAiBudget(kind: AiSpendKind): Promise<NextResponse | null> {
  if (isKilled()) return disabledResponse()

  const cap = dailyCap(kind)
  const db = adminDb()
  const ref = db.doc(`aiUsage/${utcDayKey()}`)

  try {
    const blocked = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const used = (snap.get(kind) as number | undefined) ?? 0
      if (used >= cap) return true
      tx.set(
        ref,
        { [kind]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
      return false
    })
    return blocked ? capResponse() : null
  } catch (err) {
    console.error('[spendGuard] budget check failed (failing open):', err)
    return null
  }
}
