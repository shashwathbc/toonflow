import {
  ref,
  getStorage,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage'
import app from './config'

const storage = getStorage(app)

export interface UploadProgress {
  progress: number
  downloadURL?: string
  error?: Error
}

const EXT_CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

// Some File objects arrive with an empty `type` (certain drag/drop or
// programmatically-built files). Storage rules gate on contentType via a
// `image/(png|jpeg|jpg|webp|gif)` match, so fall back to the extension rather
// than sending an empty contentType that the rules would reject.
function resolveContentType(file: File): string | undefined {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext ? EXT_CONTENT_TYPE[ext] : undefined
}

export function uploadFile(
  path: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): { task: UploadTask; promise: Promise<string> } {
  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, file, {
    contentType: resolveContentType(file),
    cacheControl: 'public, max-age=31536000',
  })

  const promise = new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.({ progress })
      },
      (error) => {
        onProgress?.({ progress: 0, error })
        reject(error)
      },
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref)
        onProgress?.({ progress: 100, downloadURL })
        resolve(downloadURL)
      }
    )
  })

  return { task, promise }
}

export async function uploadUserAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`users/${uid}/avatar/avatar.${ext}`, file)
  return promise
}

export async function uploadUserBanner(uid: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`users/${uid}/banner/banner.${ext}`, file)
  return promise
}

// Content asset paths are scoped by the uploader's uid as the SECOND segment
// (novels/{uid}/… , webtoons/{uid}/…), so the storage rules can authorize by
// `isOwner(uid)` from the path alone. This avoids cross-service Firestore reads
// from Storage rules, which don't resolve reliably in this project.

export async function uploadNovelCover(
  uid: string,
  novelId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`novels/${uid}/${novelId}/cover.${ext}`, file, onProgress)
  return promise
}

export async function uploadNovelBanner(
  uid: string,
  novelId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`novels/${uid}/${novelId}/banner.${ext}`, file, onProgress)
  return promise
}

export async function uploadWebtoonCover(
  uid: string,
  webtoonId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`webtoons/${uid}/${webtoonId}/cover.${ext}`, file, onProgress)
  return promise
}

export async function uploadWebtoonBanner(
  uid: string,
  webtoonId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`webtoons/${uid}/${webtoonId}/banner.${ext}`, file, onProgress)
  return promise
}

export async function uploadEpisodePanel(
  uid: string,
  webtoonId: string,
  episodeId: string,
  file: File,
  order: number,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(
    `webtoons/${uid}/${webtoonId}/${episodeId}/panel_${order}.${ext}`,
    file,
    onProgress
  )
  return promise
}

/**
 * Uploads an image placed on the infinite canvas. Shares the same
 * `webtoons/{uid}/{webtoonId}/{episodeId}/…` prefix as panel uploads, so the
 * existing Storage owner-write rule already authorizes it. Storing the returned
 * URL (never a base64 data URL) on the element keeps the canvas project small.
 */
export async function uploadCanvasAsset(
  uid: string,
  webtoonId: string,
  episodeId: string,
  file: File,
  assetId: string,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const { promise } = uploadFile(
    `webtoons/${uid}/${webtoonId}/${episodeId}/asset_${assetId}.${ext}`,
    file,
    onProgress
  )
  return promise
}

/**
 * Uploads a character reference portrait. Path `webtoons/{uid}/{webtoonId}/
 * characters/{charId}.ext` matches the existing 4-level webtoon Storage rule
 * (owner write, public read), so no rules change is needed.
 */
export async function uploadCharacterImage(
  uid: string,
  webtoonId: string,
  characterId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const { promise } = uploadFile(
    `webtoons/${uid}/${webtoonId}/characters/${characterId}.${ext}`,
    file,
    onProgress
  )
  return promise
}

export async function uploadMessageImage(
  conversationId: string,
  senderId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  // senderId is a path segment so the storage rule authorizes via isOwner(uid).
  const { promise } = uploadFile(
    `conversations/${conversationId}/${senderId}/${Date.now()}.${ext}`,
    file,
    onProgress
  )
  return promise
}

// ── Art Studio ──────────────────────────────────────────────
// Two prefixes with deliberately different exposure:
//
//   artworks/{uid}/{artworkId}/…   PUBLIC read — only ever holds assets the
//                                  creator has chosen to publish or preview.
//   private/{uid}/…                NO client access at all (Storage rules deny
//                                  it outright). Drafts and generated video
//                                  live here and are served through a
//                                  short-lived signed URL from the API.
//
// The split is what makes "don't expose permanent public URLs for private user
// projects" structural rather than a naming convention: a draft physically
// cannot be fetched with a plain download URL, because no client — not even its
// owner — can read the private prefix.

export async function uploadArtworkOriginal(
  uid: string,
  artworkId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const { promise } = uploadFile(`artworks/${uid}/${artworkId}/original.${ext}`, file, onProgress)
  return promise
}

/** Flattened export of the canvas — what the marketplace and mockups display. */
export async function uploadArtworkRender(
  uid: string,
  artworkId: string,
  blob: Blob,
  variant: 'full' | 'thumb' = 'full',
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const file = new File([blob], `${variant}.png`, { type: blob.type || 'image/png' })
  const { promise } = uploadFile(`artworks/${uid}/${artworkId}/${variant}.png`, file, onProgress)
  return promise
}

/** Composed product mockup used as the marketplace listing image. */
export async function uploadProductPreview(
  uid: string,
  productId: string,
  blob: Blob,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const file = new File([blob], 'preview.png', { type: blob.type || 'image/png' })
  const { promise } = uploadFile(`products/${uid}/${productId}/preview.png`, file, onProgress)
  return promise
}

/** Character reference sheet for the Anime Studio (owner-scoped, public read). */
export async function uploadAnimeCharacterImage(
  uid: string,
  characterId: string,
  file: File,
  index: number,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const { promise } = uploadFile(`animeCharacters/${uid}/${characterId}/ref_${index}.${ext}`, file, onProgress)
  return promise
}

/** Creator-supplied audio for the video editor (music beds, voiceover takes). */
export async function uploadEditorAudio(
  uid: string,
  projectId: string,
  file: File,
  assetId: string,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase()
  const { promise } = uploadFile(`animeProjects/${uid}/${projectId}/audio/${assetId}.${ext}`, file, onProgress)
  return promise
}

export async function deleteStorageFile(url: string): Promise<void> {
  const fileRef = ref(storage, url)
  await deleteObject(fileRef)
}
