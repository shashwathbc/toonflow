// Support requests: stored via the Admin SDK (clients never write directly)
// and acknowledged with an auto-reply from the Toonflow Gmail account.
// Env needed for email: GMAIL_USER, GMAIL_APP_PASSWORD (Google App Password).
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'
import { adminAuth, adminDb } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME, APP_NAME } from '@/lib/utils/constants'

export const runtime = 'nodejs'

const SUPPORT_EMAIL = 'toonflowstudiopaint@gmail.com'
const TYPES = ['question', 'issue'] as const
type SupportType = (typeof TYPES)[number]

interface SupportBody {
  type: SupportType
  name: string
  email: string
  subject: string
  message: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

async function sendAutoReply(to: string, name: string, type: SupportType): Promise<boolean> {
  const user = process.env.GMAIL_USER ?? SUPPORT_EMAIL
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!pass) {
    console.warn('[Support] GMAIL_APP_PASSWORD not set — skipping auto-reply email')
    return false
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  const topic = type === 'issue' ? 'issue report' : 'question'
  await transporter.sendMail({
    from: `"${APP_NAME}" <${SUPPORT_EMAIL}>`,
    to,
    subject: `We received your ${topic} — ${APP_NAME}`,
    text:
`Hi ${name || 'there'},

Thanks for connecting with us! We've received your ${topic} and our team will review it shortly. We'll get back to you at this email address as soon as possible — usually within 24–48 hours.

In the meantime, feel free to keep reading and exploring on Toonflow.

Warm regards,
The ${APP_NAME} Team
${SUPPORT_EMAIL}

—
This is an automated confirmation. Please don't reply to this email; we'll reach out to you directly.`,
    html:
`<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="margin:0 0 16px;font-size:18px">TOONFLOW <span style="color:#2DCA72">STUDIO PAINT</span></h2>
  <p>Hi ${name || 'there'},</p>
  <p>Thanks for connecting with us! We've received your <strong>${topic}</strong> and our team will review it shortly.</p>
  <p>We'll get back to you at this email address as soon as possible — usually within <strong>24–48 hours</strong>.</p>
  <p>In the meantime, feel free to keep reading and exploring on Toonflow.</p>
  <p style="margin-top:24px">Warm regards,<br/>The ${APP_NAME} Team<br/><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
  <p style="font-size:12px;color:#8a8a8a">This is an automated confirmation. Please don't reply to this email; we'll reach out to you directly.</p>
</div>`,
  })
  return true
}

export async function POST(req: NextRequest) {
  try {
    return await handleSupportRequest(req)
  } catch (e) {
    console.error('[Support] request failed:', e)
    return NextResponse.json(
      { error: 'Something went wrong on our side. Please try again later.' },
      { status: 500 }
    )
  }
}

async function handleSupportRequest(req: NextRequest): Promise<NextResponse> {
  let body: SupportBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const type: SupportType = TYPES.includes(body.type) ? body.type : 'question'
  const name = (body.name ?? '').toString().trim().slice(0, 100)
  const email = (body.email ?? '').toString().trim().slice(0, 254)
  const subject = (body.subject ?? '').toString().trim().slice(0, 150)
  const message = (body.message ?? '').toString().trim().slice(0, 4000)

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (!subject || !message) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
  }

  // Attach the verified uid when the visitor is signed in (optional)
  let userId: string | null = null
  const idToken = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (idToken) {
    try {
      userId = (await adminAuth().verifyIdToken(idToken)).uid
    } catch { /* anonymous submission is fine */ }
  }

  const db = adminDb()

  // Light abuse guard: max 5 open requests per email per day
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db.collection('supportRequests')
    .where('email', '==', email)
    .where('createdAt', '>=', dayAgo)
    .limit(5)
    .get()
  if (recent.size >= 5) {
    return NextResponse.json({ error: 'Too many requests today. Please try again tomorrow.' }, { status: 429 })
  }

  const ref = await db.collection('supportRequests').add({
    type,
    name,
    email,
    subject,
    message,
    userId,
    status: 'open',
    emailSent: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  let emailSent = false
  try {
    emailSent = await sendAutoReply(email, name, type)
    if (emailSent) await ref.update({ emailSent: true })
  } catch (e) {
    console.error('[Support] auto-reply failed:', e)
  }

  return NextResponse.json({ ok: true, id: ref.id, emailSent })
}
