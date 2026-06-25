import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage'
import { storage } from './config'

export interface UploadProgress {
  progress: number
  downloadURL?: string
  error?: Error
}

export function uploadFile(
  path: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): { task: UploadTask; promise: Promise<string> } {
  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
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

export async function uploadNovelCover(
  novelId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`novels/${novelId}/cover/cover.${ext}`, file, onProgress)
  return promise
}

export async function uploadNovelBanner(
  novelId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`novels/${novelId}/banner/banner.${ext}`, file, onProgress)
  return promise
}

export async function uploadWebtoonCover(
  webtoonId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(`webtoons/${webtoonId}/cover/cover.${ext}`, file, onProgress)
  return promise
}

export async function uploadEpisodePanel(
  webtoonId: string,
  episodeId: string,
  file: File,
  order: number,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { promise } = uploadFile(
    `webtoons/${webtoonId}/episodes/${episodeId}/panel_${order}.${ext}`,
    file,
    onProgress
  )
  return promise
}

export async function deleteStorageFile(url: string): Promise<void> {
  const fileRef = ref(storage, url)
  await deleteObject(fileRef)
}
