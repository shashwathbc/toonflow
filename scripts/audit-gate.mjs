#!/usr/bin/env node
// CI security gate. Wraps `npm audit --json` and fails the build on any
// high/critical advisory EXCEPT a small, documented allowlist of advisory
// SOURCES we have investigated and consciously accept.
//
// It keys on the advisory OBJECT (its root package via `via[].name`), not on the
// top-level package name. That matters because npm's over-broad range for the
// `brace-expansion` advisory makes it cascade: minimatch → glob → rimraf →
// eslint(+plugins) → google-gax all get flagged "high" purely because they sit
// above brace-expansion in the tree. Those cascade packages carry no advisory of
// their own — only a string reference — so gating on the advisory object means
// one allowlist entry (brace-expansion) covers the whole cascade WITHOUT blinding
// us to a genuine, independent future advisory in eslint/next/google-gax/etc.
//
// Why brace-expansion is accepted: npm's range `<=5.0.7` over-matches the
// *patched* 1.1.x/2.1.x releases (numerically <= 5.0.7). The only genuinely
// vulnerable copy in our tree (5.0.6, under minimatch@10) is updated in-range to
// 5.0.8. Forcing 5.x onto ESLint's minimatch@3 (which needs the CJS-callable v1)
// breaks the linter, so a blanket override is not viable. Re-evaluate when npm
// tightens the advisory range or the ESLint toolchain moves off minimatch@3.
import { execSync } from 'node:child_process'

/** advisory root package name -> reason we accept it */
const ALLOWLIST = {
  'brace-expansion':
    'npm range <=5.0.7 over-matches patched 1.1.x/2.1.x; only vulnerable copy (5.0.6) is updated to 5.0.8; forcing 5.x onto ESLint\'s minimatch@3 breaks the linter.',
}

function getAudit() {
  try {
    return JSON.parse(execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout.toString())
      } catch {
        /* fall through */
      }
    }
    console.error('audit-gate: could not run/parse `npm audit --json`:', err.message)
    process.exit(2)
  }
}

const vulns = getAudit().vulnerabilities ?? {}

// Collect DISTINCT advisory objects (by source id) at high/critical severity.
const advisories = new Map()
for (const info of Object.values(vulns)) {
  if (info.severity !== 'high' && info.severity !== 'critical') continue
  for (const via of info.via ?? []) {
    if (typeof via === 'object' && via.title) {
      advisories.set(via.source ?? via.url ?? via.title, {
        pkg: via.name ?? via.title.split(':')[0],
        severity: via.severity,
        title: via.title,
      })
    }
  }
}

const accepted = []
const blocking = []
for (const [source, a] of advisories) {
  if (a.pkg in ALLOWLIST) accepted.push({ source, ...a })
  else blocking.push({ source, ...a })
}

if (accepted.length) {
  console.log('audit-gate: accepted (allowlisted) advisories:')
  for (const a of accepted) console.log(`  • [${a.severity}] ${a.pkg} — ${a.title}`)
}

if (blocking.length) {
  console.error('\naudit-gate: FAIL — un-allowlisted high/critical advisories:')
  for (const b of blocking) console.error(`  ✖ [${b.severity}] ${b.pkg} :: ${b.title}`)
  console.error('\nFix them (`npm audit` for detail) or, if truly unavoidable, add a documented entry to ALLOWLIST in scripts/audit-gate.mjs.')
  process.exit(1)
}

console.log(`\naudit-gate: PASS — no un-allowlisted high/critical advisories (${accepted.length} accepted).`)
process.exit(0)
