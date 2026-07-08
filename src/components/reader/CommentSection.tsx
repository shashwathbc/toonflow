'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import {
  MessageSquare, Send, Loader2, ChevronUp,
  Trash2, Heart, CornerDownRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { getComments, addComment, deleteComment } from '@/lib/firebase/firestore'
import { getReplies, addReply, toggleLike, isLiked } from '@/lib/firebase/engagement'
import { cn } from '@/lib/utils/cn'
import { formatCount } from '@/lib/utils/formatters'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Comment } from '@/types'

function timeAgo(ts: unknown): string {
  const secs = ts && typeof ts === 'object' && 'seconds' in (ts as object)
    ? (ts as { seconds: number }).seconds
    : Math.floor(Date.now() / 1000)
  const diff = Math.floor(Date.now() / 1000) - secs
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Avatar({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  return (
    <div
      className={cn(
        'rounded-full bg-bg-elevated overflow-hidden flex-shrink-0 flex items-center justify-center',
        size <= 26 ? 'w-[26px] h-[26px]' : 'w-8 h-8'
      )}
    >
      {url
        ? <Image src={url} alt={name} width={size} height={size} className="object-cover w-full h-full" />
        : <span className="text-xs font-bold text-text-muted">{name[0]?.toUpperCase()}</span>
      }
    </div>
  )
}

// ── Single comment with replies ──────────────────────────────

function CommentItem({
  comment, targetId, targetType, currentUid, creatorId, depth = 0,
}: {
  comment: Comment
  targetId: string
  targetType: Comment['targetType']
  currentUid: string | null
  creatorId?: string
  depth?: number
}) {
  const [replies, setReplies] = useState<Comment[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(comment.likeCount ?? 0)
  const [deleted, setDeleted] = useState(false)
  const { firebaseUser, userProfile } = useAuth()

  useEffect(() => {
    if (!firebaseUser) return
    isLiked(firebaseUser.uid, 'comment', comment.id).then(setLiked).catch(() => {})
  }, [firebaseUser, comment.id])

  const loadReplies = useCallback(async () => {
    const r = await getReplies(comment.id)
    setReplies(r)
    setShowReplies(true)
  }, [comment.id])

  const handleLike = async () => {
    if (!firebaseUser) { toast.error('Sign in to like'); return }
    const prev = liked
    setLiked(!prev)
    setLikeCount((c) => prev ? c - 1 : c + 1)
    try {
      await toggleLike(firebaseUser.uid, 'comment', comment.id)
    } catch {
      setLiked(prev)
      setLikeCount((c) => prev ? c + 1 : c - 1)
    }
  }

  const handleReply = async () => {
    if (!firebaseUser || !userProfile || !replyText.trim()) return
    setSending(true)
    try {
      const newReply = await addReply({
        targetId,
        targetType,
        authorId: firebaseUser.uid,
        authorName: userProfile.displayName,
        authorPhotoURL: userProfile.photoURL,
        content: replyText.trim(),
        parentId: comment.id,
      })
      setReplies((prev) => [...prev, {
        id: newReply,
        targetId, targetType,
        authorId: firebaseUser.uid,
        authorName: userProfile.displayName,
        authorPhotoURL: userProfile.photoURL,
        content: replyText.trim(),
        likeCount: 0,
        isEdited: false,
        parentId: comment.id,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      }])
      setReplyText('')
      setReplying(false)
      setShowReplies(true)
      toast.success('Reply posted')
    } catch {
      toast.error('Failed to post reply')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (!firebaseUser || firebaseUser.uid !== comment.authorId) return
    try {
      await deleteComment(comment.id)
      setDeleted(true)
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (deleted) return null

  const isCreator = comment.authorId === creatorId
  const isOwn = firebaseUser?.uid === comment.authorId

  return (
    <div className={cn('flex gap-3', depth > 0 && 'ml-9 pl-3 border-l border-bg-border/50')}>
      <Avatar name={comment.authorName} url={comment.authorPhotoURL} size={depth > 0 ? 26 : 32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-text">{comment.authorName}</span>
          {isCreator && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-accent/10 text-accent rounded-full">Creator</span>
          )}
          <span className="text-xs text-text-muted">{timeAgo(comment.createdAt)}</span>
          {comment.isEdited && <span className="text-[10px] text-text-muted">(edited)</span>}
        </div>

        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>

        <div className="flex items-center gap-3 mt-2">
          <Tooltip label={liked ? 'Unlike comment' : 'Like comment'}>
            <button
              type="button"
              onClick={handleLike}
              aria-label={liked ? 'Unlike comment' : 'Like comment'}
              {...(liked ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded',
                liked ? 'text-danger' : 'text-text-muted hover:text-text'
              )}
            >
              <Heart size={12} className={cn(liked && 'fill-current')} aria-hidden="true" />
              {likeCount > 0 && <span>{formatCount(likeCount)}</span>}
            </button>
          </Tooltip>

          {depth === 0 && (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="text-xs text-text-muted hover:text-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
            >
              Reply
            </button>
          )}

          {isOwn && (
            <Tooltip label="Delete comment">
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Delete comment"
                className="text-xs text-text-muted hover:text-danger transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none rounded"
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Reply input */}
        {replying && (
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
              placeholder="Write a reply…"
              className="flex-1 px-3 py-1.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Write a reply"
            />
            <Tooltip label="Post reply">
              <button
                type="button"
                onClick={handleReply}
                disabled={!replyText.trim() || sending}
                className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label="Post reply"
              >
                {sending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              </button>
            </Tooltip>
          </div>
        )}

        {/* Toggle replies */}
        {depth === 0 && (
          <div className="mt-2">
            {!showReplies ? (
              <button
                type="button"
                onClick={loadReplies}
                className="flex items-center gap-1 text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
              >
                <CornerDownRight size={11} aria-hidden="true" /> Show replies
              </button>
            ) : replies.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowReplies(false)}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
                >
                  <ChevronUp size={11} aria-hidden="true" /> Hide replies
                </button>
                <div className="space-y-4">
                  {replies.map((r) => (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      targetId={targetId}
                      targetType={targetType}
                      currentUid={currentUid}
                      creatorId={creatorId}
                      depth={1}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-text-muted">No replies yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Comment Section ─────────────────────────────────────

interface CommentSectionProps {
  targetId: string
  targetType: Comment['targetType']
  creatorId?: string
}

export default function CommentSection({ targetId, targetType, creatorId }: CommentSectionProps) {
  const { firebaseUser, userProfile } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  // loading derives from "has the current target been fetched" so the load
  // effect never calls setState synchronously (react-hooks/set-state-in-effect)
  const targetKey = `${targetType}|${targetId}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== targetKey

  const load = useCallback(() => {
    getComments(targetId, targetType)
      .then(setComments)
      .catch(() => { /* silently fail */ })
      .finally(() => setLoadedKey(`${targetType}|${targetId}`))
  }, [targetId, targetType])

  useEffect(() => { load() }, [load])

  const sorted = [...comments].sort((a, b) => {
    const ts = (v: unknown) => (v && typeof v === 'object' && 'seconds' in (v as object)) ? (v as { seconds: number }).seconds : 0
    return sort === 'newest' ? ts(b.createdAt) - ts(a.createdAt) : ts(a.createdAt) - ts(b.createdAt)
  })

  const handlePost = async () => {
    if (!firebaseUser || !userProfile || !text.trim()) return
    setSending(true)
    try {
      const newId = await addComment({
        targetId,
        targetType,
        authorId: firebaseUser.uid,
        authorName: userProfile.displayName,
        authorPhotoURL: userProfile.photoURL,
        content: text.trim(),
        parentId: null,
      })
      const optimistic: Comment = {
        id: newId,
        targetId, targetType,
        authorId: firebaseUser.uid,
        authorName: userProfile.displayName,
        authorPhotoURL: userProfile.photoURL,
        content: text.trim(),
        likeCount: 0,
        isEdited: false,
        parentId: null,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      }
      setComments((prev) => [optimistic, ...prev])
      setText('')
      toast.success('Comment posted!')
    } catch {
      toast.error('Failed to post comment')
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 id="comments-heading" className="text-base font-bold text-text flex items-center gap-2">
          <MessageSquare size={16} aria-hidden="true" />
          Discussion
          {comments.length > 0 && (
            <span className="text-sm text-text-muted font-normal">({comments.length})</span>
          )}
        </h2>
        {comments.length > 1 && (
          <div className="flex gap-1">
            {(['newest', 'oldest'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={cn(
                  'px-3 py-1 text-xs rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                  sort === s ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text'
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comment input */}
      {firebaseUser ? (
        <div className="flex gap-3">
          <Avatar name={userProfile?.displayName ?? 'U'} url={userProfile?.photoURL ?? null} />
          <div className="flex-1 flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost()
              }}
              placeholder="Share your thoughts…"
              rows={2}
              className="flex-1 px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              aria-label="Write a comment"
            />
            <Tooltip label="Post comment">
              <button
                type="button"
                onClick={handlePost}
                disabled={!text.trim() || sending}
                className="self-end p-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label="Post comment"
              >
                {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              </button>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-6 bg-bg-elevated rounded-xl text-sm text-text-muted">
          <MessageSquare size={14} className="mr-2" aria-hidden="true" />
          Sign in to join the discussion
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-bg-elevated flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-bg-elevated rounded" />
                <div className="h-3 w-full bg-bg-elevated rounded" />
                <div className="h-3 w-3/4 bg-bg-elevated rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p className="text-sm">No comments yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sorted.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              targetId={targetId}
              targetType={targetType}
              currentUid={firebaseUser?.uid ?? null}
              creatorId={creatorId}
            />
          ))}
        </div>
      )}
    </section>
  )
}
