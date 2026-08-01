'use client'

import ExportMenu from '@/components/reader/ExportMenu'
import { getEpisodePanelUrls } from '@/lib/webtoon/export/formats'
import { urlPanelSource } from '@/lib/webtoon/export/run'
import type { Episode } from '@/types'

interface Props {
  webtoonTitle: string
  episode: Pick<Episode, 'panels' | 'episodeNumber' | 'title'>
}

/**
 * Reader-side download control: the shared {@link ExportMenu} wired to a
 * published episode's panel URLs.
 */
export default function DownloadEpisodeMenu({ webtoonTitle, episode }: Props) {
  return (
    <ExportMenu
      triggerLabel="Download episode"
      prepare={async () => ({
        source: urlPanelSource(getEpisodePanelUrls(episode)),
        meta: {
          webtoonTitle,
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.title,
        },
      })}
    />
  )
}
