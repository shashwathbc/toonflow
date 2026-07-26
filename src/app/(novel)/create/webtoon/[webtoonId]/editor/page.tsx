import { redirect } from 'next/navigation'

// The infinite canvas is now the main webtoon editor. This former sub-route
// redirects to it so old links/bookmarks keep working.
export default async function LegacyEditorRedirect({
  params,
}: {
  params: Promise<{ webtoonId: string }>
}) {
  const { webtoonId } = await params
  redirect(`/create/webtoon/${webtoonId}`)
}
