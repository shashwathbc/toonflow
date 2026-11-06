// Firestore service layer for the Anime Studio. Client SDK — every write here
// is additionally gated by firestore.rules, which is the real enforcement:
// ownerId is pinned to the caller, and the generation-managed fields
// (status/storageKey/generationJobId/durationSec) are refused from clients
// entirely, so a user can never mark their own scene "ready" and conjure a clip.
//
// Components must never import firebase/firestore directly — go through here.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './db'
import type {
  AnimeCharacter,
  AnimeProject,
  AnimeScene,
  AspectRatio,
  GenerationJob,
  GenerationSettings,
  ProjectTimeline,
  ResolutionId,
} from '@/types/anime'

export const PROJECTS = 'animeProjects'
export const CHARACTERS = 'animeCharacters'
export const JOBS = 'generationJobs'

const projectRef = (projectId: string) => doc(db, PROJECTS, projectId)
const scenesRef = (projectId: string) => collection(db, PROJECTS, projectId, 'scenes')
const sceneRef = (projectId: string, sceneId: string) => doc(db, PROJECTS, projectId, 'scenes', sceneId)
const timelineRef = (projectId: string) => doc(db, PROJECTS, projectId, 'editor', 'timeline')
const revisionsRef = (projectId: string) => collection(db, PROJECTS, projectId, 'revisions')

/** Defaults a brand-new project starts from, and that new scenes inherit. */
export const DEFAULT_PROJECT_DEFAULTS: AnimeProject['defaults'] = {
  animeStyle: 'modern-anime',
  videoStyle: 'cinematic',
  aspectRatio: '16:9',
  resolution: '720p',
  fps: 24,
}

export function defaultSettings(defaults: AnimeProject['defaults']): GenerationSettings {
  return {
    prompt: '',
    negativePrompt: '',
    videoStyle: defaults.videoStyle,
    animeStyle: defaults.animeStyle,
    cameraMovement: 'slow-pan',
    environment: 'auto',
    lighting: 'natural',
    mood: 'epic',
    aspectRatio: defaults.aspectRatio,
    durationSec: 5,
    resolution: defaults.resolution,
    fps: defaults.fps,
    characterIds: [],
    audio: { music: 'none', sfx: false },
  }
}

// ── Projects ────────────────────────────────────────────────

export async function createAnimeProject(
  ownerId: string,
  ownerName: string,
  input: {
    title: string
    description?: string
    ownerPhotoURL?: string | null
    defaults?: Partial<AnimeProject['defaults']>
  },
): Promise<string> {
  const ref = doc(collection(db, PROJECTS))
  await setDoc(ref, {
    ownerId,
    ownerName,
    ownerPhotoURL: input.ownerPhotoURL ?? null,
    title: input.title,
    description: input.description ?? '',
    thumbnailURL: null,
    status: 'draft',
    visibility: 'private',
    genres: [],
    // Engagement counters start at zero and are server-managed from here on —
    // the Firestore rules pin them on create and refuse client writes after.
    viewCount: 0,
    likeCount: 0,
    sceneCount: 0,
    durationSec: 0,
    defaults: { ...DEFAULT_PROJECT_DEFAULTS, ...input.defaults },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
  })
  return ref.id
}

export async function getAnimeProject(projectId: string): Promise<AnimeProject | null> {
  const snap = await getDoc(projectRef(projectId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as AnimeProject) : null
}

/**
 * Live list of the caller's projects, newest first. A listener (not a one-shot
 * read) so a generation completing in another tab updates the grid immediately.
 */
export function subscribeToUserProjects(
  ownerId: string,
  onData: (projects: AnimeProject[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, PROJECTS),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc'),
    fsLimit(100),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AnimeProject)),
    (err) => onError?.(err),
  )
}

/**
 * Fields a client is allowed to change on a project.
 *
 * `status`/`visibility`/`publishedAt` are deliberately ABSENT: taking a project
 * public is what makes its clips world-playable, so it runs through
 * /api/anime/publish (which verifies a generated scene actually exists) and the
 * Firestore rules refuse those keys from a client.
 */
export type ProjectPatch = Partial<
  Pick<AnimeProject, 'title' | 'description' | 'thumbnailURL' | 'defaults' | 'genres'>
>

export async function updateAnimeProject(projectId: string, patch: ProjectPatch): Promise<void> {
  await updateDoc(projectRef(projectId), { ...patch, updatedAt: serverTimestamp() })
}

/**
 * Delete a project and everything under it. Firestore has no cascading delete,
 * so orphaned subcollections would otherwise linger, still readable by their
 * owner and still counted by any collection-group query.
 */
export async function deleteAnimeProject(projectId: string): Promise<void> {
  const [scenes, revisions] = await Promise.all([
    getDocs(scenesRef(projectId)),
    getDocs(query(revisionsRef(projectId), fsLimit(50))),
  ])
  const batch = writeBatch(db)
  scenes.docs.forEach((d) => batch.delete(d.ref))
  revisions.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(timelineRef(projectId))
  batch.delete(projectRef(projectId))
  await batch.commit()
}

export async function duplicateAnimeProject(
  ownerId: string,
  ownerName: string,
  source: AnimeProject,
): Promise<string> {
  const newId = await createAnimeProject(ownerId, ownerName, {
    title: `${source.title} (copy)`.slice(0, 120),
    description: source.description,
    ownerPhotoURL: source.ownerPhotoURL,
    defaults: source.defaults,
  })
  const scenes = await getDocs(query(scenesRef(source.id), orderBy('order', 'asc')))
  const batch = writeBatch(db)
  scenes.docs.forEach((d) => {
    const data = d.data() as AnimeScene
    const target = doc(scenesRef(newId))
    batch.set(target, {
      projectId: newId,
      ownerId,
      title: data.title,
      prompt: data.prompt,
      settings: data.settings,
      // A copy has NOT been generated. Carrying the storage key across would
      // make the duplicate claim a clip it does not own, and would let a
      // deleted original's bytes stay reachable through the copy.
      generationJobId: null,
      status: 'idle',
      storageKey: null,
      posterKey: null,
      durationSec: 0,
      order: data.order,
      metadata: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
  batch.update(projectRef(newId), { sceneCount: scenes.size, updatedAt: serverTimestamp() })
  await batch.commit()
  return newId
}

// ── Scenes ──────────────────────────────────────────────────

export function subscribeToScenes(
  projectId: string,
  onData: (scenes: AnimeScene[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(scenesRef(projectId), orderBy('order', 'asc'))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AnimeScene)),
    (err) => onError?.(err),
  )
}

export async function createScene(
  projectId: string,
  ownerId: string,
  input: { title: string; prompt: string; settings: GenerationSettings; order: number },
): Promise<string> {
  const ref = doc(scenesRef(projectId))
  await setDoc(ref, {
    projectId,
    ownerId,
    title: input.title,
    prompt: input.prompt,
    settings: input.settings,
    generationJobId: null,
    status: 'idle',
    storageKey: null,
    posterKey: null,
    durationSec: 0,
    order: input.order,
    metadata: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await bumpSceneCount(projectId, 1)
  return ref.id
}

/** Client-writable scene fields. Generation state is server-managed. */
export type ScenePatch = Partial<Pick<AnimeScene, 'title' | 'prompt' | 'settings' | 'order'>>

export async function updateScene(projectId: string, sceneId: string, patch: ScenePatch): Promise<void> {
  await updateDoc(sceneRef(projectId, sceneId), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteScene(projectId: string, sceneId: string): Promise<void> {
  await deleteDoc(sceneRef(projectId, sceneId))
  await bumpSceneCount(projectId, -1)
}

/** Persist a whole reorder in one batch so the list can't be seen half-sorted. */
export async function reorderScenes(projectId: string, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(sceneRef(projectId, id), { order: index, updatedAt: serverTimestamp() })
  })
  batch.update(projectRef(projectId), { updatedAt: serverTimestamp() })
  await batch.commit()
}

/**
 * Reconcile the project's denormalized totals with what its scenes actually
 * contain. Called when the workspace notices drift — generation writes
 * `durationSec` onto scenes server-side, so the parent can only learn the real
 * total from the client that is already listening to them.
 */
export async function syncProjectTotals(
  projectId: string,
  sceneCount: number,
  durationSec: number,
): Promise<void> {
  await updateDoc(projectRef(projectId), {
    sceneCount,
    durationSec: Math.round(durationSec * 10) / 10,
    updatedAt: serverTimestamp(),
  })
}

async function bumpSceneCount(projectId: string, delta: number): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(projectRef(projectId))
    if (!snap.exists()) return
    const next = Math.max(0, ((snap.get('sceneCount') as number | undefined) ?? 0) + delta)
    tx.update(projectRef(projectId), { sceneCount: next, updatedAt: serverTimestamp() })
  })
}

// ── Public catalog reads ────────────────────────────────────
//
// Published anime sits in the same catalog as novels and webtoons, so these
// mirror browseContent's shape: a single-field `where` (auto-indexed, can never
// fail with FAILED_PRECONDITION) plus in-memory filtering and sorting. That
// keeps a new content type from needing a composite index per sort option.

/** Statuses a catalog entry may hold. Anime has no ongoing/hiatus concept. */
const PUBLIC_ANIME_STATUS = 'published'

export interface AnimeCatalogOptions {
  genres?: string[]
  sortBy?: 'trending' | 'newest' | 'rating'
  limitCount?: number
}

/**
 * Published, publicly-visible anime for Browse / Home / Originals.
 *
 * `visibility == public` is the single indexed filter; `unlisted` titles are
 * excluded here by construction, which is exactly the contract the rules
 * enforce (`list` requires published + public).
 */
export async function listPublishedAnime(
  options: AnimeCatalogOptions = {},
): Promise<AnimeProject[]> {
  const { genres: genreList = [], sortBy = 'trending', limitCount = 24 } = options

  const snap = await getDocs(
    query(
      collection(db, PROJECTS),
      where('visibility', '==', 'public'),
      fsLimit(Math.max(limitCount * 4, 48)),
    ),
  )

  let items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as AnimeProject)
    .filter((project) => project.status === PUBLIC_ANIME_STATUS)

  if (genreList.length > 0) {
    items = items.filter((project) => (project.genres ?? []).some((g) => genreList.includes(g)))
  }

  items.sort((a, b) => {
    if (sortBy === 'newest') {
      const at = (a.publishedAt ?? a.createdAt)?.seconds ?? 0
      const bt = (b.publishedAt ?? b.createdAt)?.seconds ?? 0
      return bt - at
    }
    // Anime carries no star rating yet, so "highest rated" falls back to likes —
    // the closest honest signal, rather than sorting by a field that is always 0.
    if (sortBy === 'rating') return (b.likeCount ?? 0) - (a.likeCount ?? 0)
    return (b.viewCount ?? 0) - (a.viewCount ?? 0)
  })

  return items.slice(0, limitCount)
}

/** One published title for the public watch page. Null when not public. */
export async function getPublishedAnime(projectId: string): Promise<AnimeProject | null> {
  const snap = await getDoc(projectRef(projectId))
  if (!snap.exists()) return null
  const project = { id: snap.id, ...snap.data() } as AnimeProject
  if (project.status !== PUBLIC_ANIME_STATUS || project.visibility === 'private') return null
  return project
}

/** Ordered scenes of a published project — the watch page's playlist. */
export async function getPublishedScenes(projectId: string): Promise<AnimeScene[]> {
  const snap = await getDocs(query(scenesRef(projectId), orderBy('order', 'asc')))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as AnimeScene)
    // Only scenes that actually hold video — an ungenerated scene has nothing to
    // play and must not appear as a gap in the playlist.
    .filter((scene) => scene.status === 'ready' && Boolean(scene.storageKey))
}

// ── Generation jobs (read-only for clients) ─────────────────

/**
 * Watch one job. Clients can read their own jobs but never write them, so this
 * reflects real server progress — a completed status here always means bytes
 * exist in the bucket.
 */
export function subscribeToJob(
  jobId: string,
  onData: (job: GenerationJob | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, JOBS, jobId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as GenerationJob) : null),
    (err) => onError?.(err),
  )
}

export function subscribeToActiveJobs(
  ownerId: string,
  onData: (jobs: GenerationJob[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, JOBS),
    where('ownerId', '==', ownerId),
    where('status', 'in', ['queued', 'processing']),
    fsLimit(20),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GenerationJob)),
    (err) => onError?.(err),
  )
}

// ── Characters ──────────────────────────────────────────────

export function subscribeToCharacters(
  ownerId: string,
  onData: (characters: AnimeCharacter[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, CHARACTERS),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc'),
    fsLimit(200),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AnimeCharacter)),
    (err) => onError?.(err),
  )
}

export type CharacterInput = Omit<AnimeCharacter, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>

export async function createCharacter(ownerId: string, input: CharacterInput): Promise<string> {
  const ref = doc(collection(db, CHARACTERS))
  await setDoc(ref, {
    ownerId,
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCharacter(characterId: string, patch: Partial<CharacterInput>): Promise<void> {
  await updateDoc(doc(db, CHARACTERS, characterId), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteCharacter(characterId: string): Promise<void> {
  await deleteDoc(doc(db, CHARACTERS, characterId))
}

// ── Timeline ────────────────────────────────────────────────

export async function loadTimeline(projectId: string): Promise<ProjectTimeline | null> {
  const snap = await getDoc(timelineRef(projectId))
  return snap.exists() ? (snap.data() as ProjectTimeline) : null
}

export async function saveTimeline(
  projectId: string,
  timeline: Omit<ProjectTimeline, 'updatedAt'>,
): Promise<void> {
  await setDoc(timelineRef(projectId), { ...timeline, updatedAt: serverTimestamp() })
}

/**
 * Snapshot the timeline for version history. Kept to a small ring (the caller
 * prunes) so recovery is possible without turning the project into an
 * unbounded write-ahead log.
 */
export async function saveRevision(
  projectId: string,
  label: string,
  timeline: Omit<ProjectTimeline, 'updatedAt'>,
): Promise<void> {
  await setDoc(doc(revisionsRef(projectId)), {
    label,
    timeline,
    createdAt: serverTimestamp(),
  })
}

export async function listRevisions(projectId: string) {
  const snap = await getDocs(query(revisionsRef(projectId), orderBy('createdAt', 'desc'), fsLimit(20)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as import('@/types/anime').TimelineRevision)
}

/** A fresh timeline for a project that has never been opened in the editor. */
export function emptyTimeline(aspectRatio: AspectRatio, fps: number): Omit<ProjectTimeline, 'updatedAt'> {
  return {
    version: 1,
    aspectRatio,
    fps,
    tracks: [
      { id: 'video-1', kind: 'video', name: 'Video 1', clips: [], muted: false, hidden: false, locked: false },
      { id: 'text-1', kind: 'text', name: 'Text', clips: [], muted: false, hidden: false, locked: false },
      { id: 'effect-1', kind: 'effect', name: 'Effects', clips: [], muted: false, hidden: false, locked: false },
      { id: 'audio-1', kind: 'audio', name: 'Audio 1', clips: [], muted: false, hidden: false, locked: false },
    ],
  }
}

export type { ResolutionId }
