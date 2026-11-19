import { HorizontalScroller } from '@/components/ui/HorizontalScroller'
import MangaCard from './MangaCard'
import type { MangaSummary } from '@/lib/mangadex/types'

/** Horizontally scrolling row of MangaDex series for the home feed. */
export default function MangaRow({ manga }: { manga: MangaSummary[] }) {
  return (
    <HorizontalScroller ariaLabel="Top manga">
      {manga.map((item) => (
        <div key={item.id} className="w-[44vw] sm:w-44 md:w-48 shrink-0 snap-start">
          <MangaCard manga={item} />
        </div>
      ))}
    </HorizontalScroller>
  )
}
