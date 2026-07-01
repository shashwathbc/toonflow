'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BookOpen, ImageIcon, Users, Heart, Eye, Bookmark, Edit3, Camera,
  AtSign, Globe, ExternalLink, Check, X, Loader2,
  BadgeCheck, Layers, Star, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import {
  getUserProfile, getNovelsByAuthor, getWebtoonsByAuthor,
  getUserBookmarks, followUser, unfollowUser, isFollowing,
  updateUserProfile, createUserDocument,
} from '@/lib/firebase/firestore'
import { uploadUserAvatar, uploadUserBanner } from '@/lib/firebase/storage'
import { formatCount, formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { UserProfile, Novel, Webtoon, BookmarkItem } from '@/types'

type Tab = 'novels' | 'webtoons' | 'bookmarks' | 'about'

function ContentCard({ title, coverURL, href, chapterCount, viewCount, status, type }: {
  title: string; coverURL: string | null; href: string
  chapterCount: number; viewCount: number; status: string; type: string
}) {
  return (
    <Link href={href} className="group block rounded-xl overflow-hidden bg-bg-card border border-bg-border hover:border-white/20 transition-all">
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        {coverURL ? (
          <Image src={coverURL} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="160px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen size={24} className="text-white/20" aria-hidden="true" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white border border-white/10 capitalize">{status}</span>
      </div>
      <div className="p-2.5">
        <h3 className="text-xs font-semibold text-white line-clamp-2 mb-1.5">{title}</h3>
        <div className="flex items-center gap-2.5 text-[10px] text-white/40">
          <span className="flex items-center gap-1"><Layers size={9} aria-hidden="true" />{chapterCount}</span>
          <span className="flex items-center gap-1"><Eye size={9} aria-hidden="true" />{formatCount(viewCount)}</span>
        </div>
      </div>
    </Link>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4 text-center">
      <div className="flex justify-center text-white/40 mb-2" aria-hidden="true">{icon}</div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/50 mt-0.5">{label}</p>
    </div>
  )
}

interface EditProfileData {
  displayName: string
  bio: string
  website: string
  twitter: string
  instagram: string
  country: string
}

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: UserProfile
  onClose: () => void
  onSaved: (updated: UserProfile) => void
}) {
  const { firebaseUser } = useAuth()
  const [form, setForm] = useState<EditProfileData>({
    displayName: profile.displayName,
    bio: profile.bio ?? '',
    website: profile.socialLinks?.website ?? '',
    twitter: profile.socialLinks?.twitter ?? '',
    instagram: profile.socialLinks?.instagram ?? '',
    country: '',
  })
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  function handleAvatarFile(file: File) {
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }
  function handleBannerFile(file: File) {
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!firebaseUser) return
    setSaving(true)
    try {
      let photoURL = profile.photoURL
      let bannerURL = profile.bannerURL

      if (avatarFile) {
        photoURL = await uploadUserAvatar(firebaseUser.uid, avatarFile)
      }
      if (bannerFile) {
        bannerURL = await uploadUserBanner(firebaseUser.uid, bannerFile)
      }

      if (!form.displayName.trim()) { toast.error('Display name is required'); return }

      const updates: Partial<UserProfile> = {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        photoURL,
        bannerURL,
        socialLinks: {
          website: form.website.trim() || undefined,
          twitter: form.twitter.trim() || undefined,
          instagram: form.instagram.trim() || undefined,
        },
      }

      await updateUserProfile(firebaseUser.uid, updates)
      toast.success('Profile updated!')
      onSaved({ ...profile, ...updates })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile'
      toast.error(msg)
      console.error('[EditProfile] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border sticky top-0 bg-bg-elevated z-10">
          <h2 id="edit-profile-title" className="font-bold text-white text-base">Edit Profile</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-white" aria-label="Close">
            <X size={16} className="text-white/60" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Banner upload */}
          <div>
            <p className="block text-xs font-medium text-white/60 mb-2" id="banner-label">Banner Image</p>
            <label
              htmlFor="banner-upload"
              className="relative h-28 bg-bg-card border-2 border-dashed border-bg-border rounded-xl overflow-hidden cursor-pointer hover:border-white/30 transition-colors block"
              aria-labelledby="banner-label"
            >
              {(bannerPreview || profile.bannerURL) ? (
                <Image src={bannerPreview ?? profile.bannerURL!} alt="Banner preview" fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-white/30">
                  <Camera size={18} aria-hidden="true" />
                  <span className="text-sm">Click to upload banner</span>
                </div>
              )}
              <input ref={bannerRef} id="banner-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerFile(f) }} />
            </label>
          </div>

          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <label
              htmlFor="avatar-upload"
              className="relative w-20 h-20 rounded-full bg-bg-card border-2 border-dashed border-bg-border overflow-hidden cursor-pointer hover:border-white/30 transition-colors flex-shrink-0 block"
              aria-label="Upload profile photo"
            >
              {(avatarPreview || profile.photoURL) ? (
                <Image src={avatarPreview ?? profile.photoURL!} alt="Avatar preview" fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/30">
                  <Camera size={16} aria-hidden="true" />
                </div>
              )}
              <input ref={avatarRef} id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f) }} />
            </label>
            <div className="flex-1">
              <label htmlFor="edit-display-name" className="block text-xs font-medium text-white/60 mb-1.5">Display Name *</label>
              <input
                id="edit-display-name"
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="input-base"
                placeholder="Your name"
                maxLength={60}
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="edit-bio" className="block text-xs font-medium text-white/60 mb-1.5">Bio</label>
            <textarea
              id="edit-bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              className="input-base resize-none"
              placeholder="Tell readers about yourself…"
              maxLength={500}
            />
            <p className="text-[11px] text-white/30 text-right mt-1">{form.bio.length}/500</p>
          </div>

          {/* Social links */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-white/60">Social Links</p>
            {[
              { id: 'edit-website', key: 'website', label: 'Website', placeholder: 'https://yoursite.com', icon: <Globe size={13} /> },
              { id: 'edit-twitter', key: 'twitter', label: 'Twitter / X', placeholder: '@handle', icon: <AtSign size={13} /> },
              { id: 'edit-instagram', key: 'instagram', label: 'Instagram', placeholder: '@handle', icon: <AtSign size={13} /> },
            ].map(({ id, key, label, placeholder, icon }) => (
              <div key={key} className="relative">
                <label htmlFor={id} className="sr-only">{label}</label>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" aria-hidden="true">{icon}</span>
                <input
                  id={id}
                  type="text"
                  value={form[key as keyof EditProfileData]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="input-base pl-8"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-bg-border flex items-center justify-end gap-3 sticky bottom-0 bg-bg-elevated">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-accent"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving…</> : <><Check size={14} aria-hidden="true" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function FollowButton({ targetUid, initialFollowing, onCountChange }: {
  targetUid: string
  initialFollowing: boolean
  onCountChange: (delta: number) => void
}) {
  const { firebaseUser } = useAuth()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!firebaseUser) { toast.error('Sign in to follow creators'); return }
    setLoading(true)
    try {
      if (following) {
        await unfollowUser(firebaseUser.uid, targetUid)
        setFollowing(false)
        onCountChange(-1)
        toast.success('Unfollowed')
      } else {
        await followUser(firebaseUser.uid, targetUid)
        setFollowing(true)
        onCountChange(1)
        toast.success('Following!')
      }
    } catch (err) {
      toast.error('Action failed — please try again')
      console.error('[FollowButton] error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
        following
          ? 'bg-white/10 text-white border border-white/20 hover:bg-danger/10 hover:text-danger hover:border-danger/30'
          : 'btn-accent'
      )}
      aria-label={following ? 'Unfollow creator' : 'Follow creator'}
      {...(following ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : (
        following ? <><Check size={14} aria-hidden="true" /> Following</> : <><Users size={14} aria-hidden="true" /> Follow</>
      )}
    </button>
  )
}

export function ProfilePageClient({ uid }: { uid: string }) {
  const { firebaseUser, loading: authLoading } = useAuth()
  const isOwnProfile = !authLoading && firebaseUser?.uid === uid

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [novels, setNovels] = useState<Novel[]>([])
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('novels')
  const [showEdit, setShowEdit] = useState(false)
  const [userIsFollowing, setUserIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  const load = useCallback(async () => {
    if (authLoading) return
    try {
      const [prof, novs, wts] = await Promise.all([
        getUserProfile(uid),
        getNovelsByAuthor(uid),
        getWebtoonsByAuthor(uid),
      ])

      let resolvedProfile = prof
      if (!resolvedProfile && isOwnProfile && firebaseUser) {
        await createUserDocument(firebaseUser)
        resolvedProfile = await getUserProfile(uid)
      }

      setProfile(resolvedProfile)
      setFollowerCount(resolvedProfile?.followerCount ?? 0)
      setNovels(novs)
      setWebtoons(wts)

      if (firebaseUser && !isOwnProfile) {
        const following = await isFollowing(firebaseUser.uid, uid)
        setUserIsFollowing(following)
      }

      if (isOwnProfile && firebaseUser) {
        const bks = await getUserBookmarks(firebaseUser.uid)
        setBookmarks(bks)
      }
    } catch (err) {
      console.error('[Profile] load error:', err)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [uid, firebaseUser, isOwnProfile, authLoading])

  useEffect(() => { load() }, [load])

  const publishedNovels = novels.filter((n) => n.status !== 'draft')
  const publishedWebtoons = webtoons.filter((w) => w.status !== 'draft')
  const totalViews = novels.reduce((s, n) => s + n.viewCount, 0) + webtoons.reduce((s, w) => s + w.viewCount, 0)
  const totalLikes = novels.reduce((s, n) => s + n.likeCount, 0) + webtoons.reduce((s, w) => s + w.likeCount, 0)

  const tabNovels = isOwnProfile ? novels : publishedNovels
  const tabWebtoons = isOwnProfile ? webtoons : publishedWebtoons

  if (loading || authLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8 animate-pulse">
        <div className="w-full h-48 bg-bg-elevated rounded-2xl mb-0" />
        <div className="px-4 -mt-14 mb-6">
          <div className="w-28 h-28 rounded-full bg-bg-elevated border-4 border-bg mb-4" />
          <div className="h-6 w-48 bg-bg-elevated rounded mb-2" />
          <div className="h-4 w-64 bg-bg-elevated rounded" />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8 max-w-lg">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-bg-elevated rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-bg-card border border-bg-border">
              <div className="aspect-[2/3] bg-bg-elevated" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-bg-elevated rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-24 text-center">
        <Users size={48} className="text-white/20 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-xl font-bold text-white mb-2">Profile Not Found</h1>
        <p className="text-white/50">This user doesn&apos;t exist or has been removed.</p>
      </div>
    )
  }

  const initials = profile.displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'novels', label: 'Novels', count: tabNovels.length },
    { id: 'webtoons', label: 'Webtoons', count: tabWebtoons.length },
    ...(isOwnProfile ? [{ id: 'bookmarks' as Tab, label: 'Bookmarks', count: bookmarks.length }] : []),
    { id: 'about', label: 'About' },
  ]

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-0">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-64 bg-bg-elevated rounded-b-2xl overflow-hidden">
        {profile.bannerURL ? (
          <Image src={profile.bannerURL} alt="Profile banner" fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-bg-elevated to-bg-elevated" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg/60 to-transparent" />
      </div>

      {/* Profile header */}
      <div className="relative px-4 sm:px-6 -mt-16 mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-end gap-4">
          {/* Avatar */}
          <div className="relative w-28 h-28 rounded-full bg-bg-elevated border-4 border-bg overflow-hidden flex-shrink-0">
            {profile.photoURL ? (
              <Image src={profile.photoURL} alt={profile.displayName} fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                <span className="text-3xl font-bold text-accent">{initials}</span>
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{profile.displayName}</h1>
              {profile.isCreator && (
                <span className="flex items-center gap-1 text-xs font-semibold text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
                  <BadgeCheck size={11} aria-hidden="true" /> Creator
                </span>
              )}
            </div>
            <p className="text-sm text-white/50 mt-0.5">@{profile.uid.slice(0, 8)}</p>
            {profile.bio && (
              <p className="text-sm text-white/70 mt-1.5 max-w-md line-clamp-2">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pb-1">
          {isOwnProfile ? (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="btn-ghost text-sm"
              aria-label="Edit your profile"
            >
              <Edit3 size={14} aria-hidden="true" /> Edit Profile
            </button>
          ) : (
            <FollowButton
              targetUid={uid}
              initialFollowing={userIsFollowing}
              onCountChange={(delta) => setFollowerCount((c) => c + delta)}
            />
          )}
        </div>
      </div>

      {/* Social links */}
      {(profile.socialLinks?.website || profile.socialLinks?.twitter || profile.socialLinks?.instagram) && (
        <div className="px-4 sm:px-6 flex flex-wrap items-center gap-4 mb-6 text-sm text-white/50">
          {profile.socialLinks?.website && (
            <a href={profile.socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent rounded">
              <Globe size={13} aria-hidden="true" /> Website <ExternalLink size={10} aria-hidden="true" />
            </a>
          )}
          {profile.socialLinks?.twitter && (
            <a href={`https://x.com/${profile.socialLinks.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent rounded">
              <AtSign size={13} aria-hidden="true" /> {profile.socialLinks.twitter}
            </a>
          )}
          {profile.socialLinks?.instagram && (
            <a href={`https://instagram.com/${profile.socialLinks.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent rounded">
              <AtSign size={13} aria-hidden="true" /> {profile.socialLinks.instagram}
            </a>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="px-4 sm:px-6 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Followers" value={formatCount(followerCount)} icon={<Users size={16} />} />
          <StatCard label="Following" value={formatCount(profile.followingCount)} icon={<Users size={16} />} />
          <StatCard label="Novels" value={tabNovels.length} icon={<BookOpen size={16} />} />
          <StatCard label="Webtoons" value={tabWebtoons.length} icon={<ImageIcon size={16} />} />
          <StatCard label="Total Views" value={formatCount(totalViews)} icon={<Eye size={16} />} />
          <StatCard label="Total Likes" value={formatCount(totalLikes)} icon={<Heart size={16} />} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6">
        <div role="tablist" aria-label="Profile sections" className="flex gap-0.5 border-b border-bg-border mb-6 overflow-x-auto scrollbar-none">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id ? 'true' : 'false'}
              aria-controls={`panel-${id}`}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t',
                activeTab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-white/50 hover:text-white'
              )}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  activeTab === id ? 'bg-accent/20 text-accent' : 'bg-white/10 text-white/50'
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div id="panel-novels" role="tabpanel" aria-label="Novels" hidden={activeTab !== 'novels'}>
          {tabNovels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen size={36} className="text-white/20 mb-4" aria-hidden="true" />
              <p className="text-white/50 text-sm">{isOwnProfile ? 'You haven\'t created any novels yet.' : 'No published novels yet.'}</p>
              {isOwnProfile && <Link href="/create/novel" className="btn-accent mt-4 text-sm">Create a Novel</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-8">
              {tabNovels.map((n) => (
                <ContentCard
                  key={n.id}
                  title={n.title}
                  coverURL={n.coverURL}
                  href={isOwnProfile ? `/create/novel/${n.id}` : `/novel/${n.id}`}
                  chapterCount={n.chapterCount}
                  viewCount={n.viewCount}
                  status={n.status}
                  type="novel"
                />
              ))}
            </div>
          )}
        </div>

        <div id="panel-webtoons" role="tabpanel" aria-label="Webtoons" hidden={activeTab !== 'webtoons'}>
          {tabWebtoons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon size={36} className="text-white/20 mb-4" aria-hidden="true" />
              <p className="text-white/50 text-sm">{isOwnProfile ? 'You haven\'t created any webtoons yet.' : 'No published webtoons yet.'}</p>
              {isOwnProfile && <Link href="/create/webtoon" className="btn-accent mt-4 text-sm">Create a Webtoon</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-8">
              {tabWebtoons.map((w) => (
                <ContentCard
                  key={w.id}
                  title={w.title}
                  coverURL={w.coverURL}
                  href={isOwnProfile ? `/create/webtoon/${w.id}` : `/webtoon/${w.id}`}
                  chapterCount={(w as Webtoon).episodeCount}
                  viewCount={w.viewCount}
                  status={w.status}
                  type="webtoon"
                />
              ))}
            </div>
          )}
        </div>

        {isOwnProfile && (
          <div id="panel-bookmarks" role="tabpanel" aria-label="Bookmarks" hidden={activeTab !== 'bookmarks'}>
            {bookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bookmark size={36} className="text-white/20 mb-4" aria-hidden="true" />
                <p className="text-white/50 text-sm">No bookmarks yet. Save content while reading to find it here.</p>
              </div>
            ) : (
              <p className="text-white/50 text-sm pb-8">{bookmarks.length} bookmarked item{bookmarks.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        )}

        <div id="panel-about" role="tabpanel" aria-label="About" hidden={activeTab !== 'about'}>
          <div className="max-w-2xl space-y-6 pb-8">
            {profile.bio && (
              <div>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-2">Bio</h2>
                <p className="text-white/80 text-sm leading-relaxed">{profile.bio}</p>
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-2">Details</h2>
              <div className="space-y-2 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-white/30" aria-hidden="true" />
                  <span>Joined {profile.createdAt ? formatDate(profile.createdAt) : '—'}</span>
                </div>
                {profile.isCreator && (
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={13} className="text-accent" aria-hidden="true" />
                    <span className="text-accent">Verified Creator</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEdit && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}
    </div>
  )
}
