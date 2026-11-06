import { cookies } from 'next/headers'
import CreateStudioShell from '@/components/create/CreateStudioShell'
import { EMAIL_COOKIE_NAME, canUseWebtoonStudio } from '@/lib/utils/constants'

/**
 * Route group for the Anime and Art studios (/create/anime, /create/art).
 *
 * Separate from (novel) — which holds the Novel/Webtoon studios — and from
 * (studio), which owns Dashboard/Wallet/Admin. Keeping them apart is what lets
 * the Create section have its own navigation without inheriting the
 * Wallet/Dashboard sidebar. Both Create groups render the SAME shell, so the
 * four studio tabs are identical whichever studio you are standing in.
 */
export default async function CreateLayout({ children }: { children: React.ReactNode }) {
  // Server-set email cookie (from the verified session) — the same source the
  // proxy gate and the Create hub use, so the tab, the hub card and the
  // /create/webtoon redirect always agree.
  const email = (await cookies()).get(EMAIL_COOKIE_NAME)?.value

  return (
    <CreateStudioShell canUseWebtoon={canUseWebtoonStudio(email)}>{children}</CreateStudioShell>
  )
}
