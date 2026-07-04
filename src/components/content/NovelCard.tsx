import Link from 'next/link'
import Image from 'next/image'
import { Star, ImageOff } from 'lucide-react'
import type { Novel } from '@/types'
import { formatCount } from '@/lib/utils/formatters'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

interface NovelCardProps {
  novel: Novel
  size?: 'sm' | 'md'
}

export default function NovelCard({ novel }: NovelCardProps) {
  return (
    <Link
      href={`/novel/${novel.id}`}
      className={cn(
        'group card overflow-hidden flex flex-col transition-transform duration-200',
        'hover:-translate-y-1 hover:border-accent/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
      )}
      aria-label={`${novel.title} — ${novel.status} novel`}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        {novel.coverURL ? (
          <Image
            src={novel.coverURL}
            alt={`Cover art for ${novel.title}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
            <ImageOff size={32} aria-hidden="true" />
            <span className="text-xs">No Cover</span>
          </div>
        )}
        {/* Status badge */}
        {novel.status !== 'draft' && (
          <div className="absolute top-2 left-2">
            <Badge
              variant={novel.status as 'ongoing' | 'completed' | 'hiatus'}
              className="uppercase text-[10px] tracking-wide"
            >
              {novel.status}
            </Badge>
          </div>
        )}
        {/* Favorites overlay */}
        {novel.bookmarkCount > 0 && (
          <div className="absolute bottom-2 left-2 text-[10px] font-semibold text-white/80 drop-shadow">
            {formatCount(novel.bookmarkCount)} FAVORITES
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="text-sm font-semibold text-text line-clamp-2 leading-tight">
          {novel.title}
        </h3>
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-text-secondary capitalize">
            {novel.genres[0] ?? 'Novel'}
          </span>
          {novel.rating > 0 && (
            <div className="flex items-center gap-1" aria-label={`Rating: ${novel.rating} out of 5`}>
              <span className="text-accent" aria-hidden="true">◎</span>
              <Star size={10} className="text-warning fill-warning" aria-hidden="true" />
              <span className="text-xs text-text-secondary">{novel.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
