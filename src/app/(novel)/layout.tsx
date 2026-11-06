import { cookies } from 'next/headers'
import CreateStudioShell from '@/components/create/CreateStudioShell'
import { EMAIL_COOKIE_NAME, canUseWebtoonStudio } from '@/lib/utils/constants'

/**
 * Route group for the Novel and Webtoon studios (/create/novel,
 * /create/webtoon) plus the /create/seed demo seeder.
 *
 * Renders the same shell as (create) so all four studios share one tab strip.
 * The shell drops its own chrome on the full-screen editors and on /create/seed
 * — see IMMERSIVE_PATTERNS in CreateStudioShell.
 */
export default async function NovelStudioLayout({ children }: { children: React.ReactNode }) {
  const email = (await cookies()).get(EMAIL_COOKIE_NAME)?.value

  return (
    <CreateStudioShell canUseWebtoon={canUseWebtoonStudio(email)}>{children}</CreateStudioShell>
  )
}
