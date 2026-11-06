// Firestore service layer for the Art Studio + marketplace. Client SDK.
//
// Reads are broad (the marketplace is public); WRITES are narrow. Anything that
// affects money or reach — publishing, pricing, counters, sales — is refused to
// clients by firestore.rules and goes through an API route instead. What stays
// client-side is exactly the draft-authoring loop, which only ever touches the
// creator's own private documents.
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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './db'
import type { ArtCategory, ArtDocument, Artwork, Product, ProductType } from '@/types/art'

export const ARTWORKS = 'artworks'
export const PRODUCTS = 'products'

const artworkRef = (id: string) => doc(db, ARTWORKS, id)
const productRef = (id: string) => doc(db, PRODUCTS, id)
const documentRef = (artworkId: string) => doc(db, ARTWORKS, artworkId, 'editor', 'document')

// ── Artworks (creator-owned) ────────────────────────────────

export interface NewArtworkInput {
  title: string
  description?: string
  category: ArtCategory
  tags?: string[]
  source: Artwork['source']
  width: number
  height: number
  sizeBytes: number
  mimeType: string
  storageKey: string | null
  imageURL: string | null
  thumbnailURL: string | null
}

export async function createArtwork(
  ownerId: string,
  ownerName: string,
  ownerPhotoURL: string | null,
  input: NewArtworkInput,
): Promise<string> {
  const ref = doc(collection(db, ARTWORKS))
  await setDoc(ref, {
    ownerId,
    ownerName,
    ownerPhotoURL,
    title: input.title,
    description: input.description ?? '',
    category: input.category,
    tags: input.tags ?? [],
    source: input.source,
    imageURL: input.imageURL,
    storageKey: input.storageKey,
    thumbnailURL: input.thumbnailURL,
    width: input.width,
    height: input.height,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    status: 'draft',
    visibility: 'private',
    rightsConfirmed: false,
    // Counters start at zero and are server-managed from here on.
    viewCount: 0,
    likeCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
  })
  return ref.id
}

export async function getArtwork(artworkId: string): Promise<Artwork | null> {
  const snap = await getDoc(artworkRef(artworkId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Artwork) : null
}

/** Draft-editable fields. Status/visibility/counters are refused by the rules. */
export type ArtworkPatch = Partial<
  Pick<Artwork, 'title' | 'description' | 'category' | 'tags' | 'imageURL' | 'thumbnailURL' | 'storageKey' | 'width' | 'height' | 'sizeBytes' | 'mimeType' | 'source'>
>

export async function updateArtwork(artworkId: string, patch: ArtworkPatch): Promise<void> {
  await updateDoc(artworkRef(artworkId), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteArtwork(artworkId: string): Promise<void> {
  await deleteDoc(documentRef(artworkId)).catch(() => undefined)
  await deleteDoc(artworkRef(artworkId))
}

export function subscribeToUserArtworks(
  ownerId: string,
  onData: (artworks: Artwork[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ARTWORKS),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc'),
    fsLimit(120),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Artwork)),
    (err) => onError?.(err),
  )
}

// ── Canvas document (the layered editor state) ──────────────

export async function loadArtDocument(artworkId: string): Promise<ArtDocument | null> {
  const snap = await getDoc(documentRef(artworkId))
  return snap.exists() ? (snap.data() as ArtDocument) : null
}

export async function saveArtDocument(artworkId: string, document: ArtDocument): Promise<void> {
  await setDoc(documentRef(artworkId), document)
}

// ── Products (creator-owned drafts; publishing is server-side) ──

export async function getProduct(productId: string): Promise<Product | null> {
  const snap = await getDoc(productRef(productId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null
}

export function subscribeToUserProducts(
  ownerId: string,
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, PRODUCTS),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc'),
    fsLimit(120),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)),
    (err) => onError?.(err),
  )
}

export async function deleteProduct(productId: string): Promise<void> {
  await deleteDoc(productRef(productId))
}

// ── Marketplace reads (public) ──────────────────────────────

export type MarketSort = 'newest' | 'trending' | 'price-low' | 'price-high'

export interface ArtQueryOptions {
  category?: ArtCategory
  sort?: MarketSort
  max?: number
}

/**
 * Published artwork for the marketplace. Sorting by `trending` uses likeCount,
 * which needs its own composite index — declared in firestore.indexes.json.
 */
export async function listPublishedArtworks(options: ArtQueryOptions = {}): Promise<Artwork[]> {
  const constraints: QueryConstraint[] = [where('status', '==', 'published')]
  if (options.category) constraints.push(where('category', '==', options.category))
  constraints.push(orderBy(options.sort === 'trending' ? 'likeCount' : 'publishedAt', 'desc'))
  constraints.push(fsLimit(options.max ?? 48))
  const snap = await getDocs(query(collection(db, ARTWORKS), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Artwork)
}

export interface ProductQueryOptions {
  productType?: ProductType
  sort?: MarketSort
  max?: number
}

export async function listPublishedProducts(options: ProductQueryOptions = {}): Promise<Product[]> {
  const constraints: QueryConstraint[] = [where('status', '==', 'published')]
  if (options.productType) constraints.push(where('productType', '==', options.productType))
  switch (options.sort) {
    case 'trending':
      constraints.push(orderBy('salesCount', 'desc'))
      break
    case 'price-low':
      constraints.push(orderBy('fromPriceMinor', 'asc'))
      break
    case 'price-high':
      constraints.push(orderBy('fromPriceMinor', 'desc'))
      break
    default:
      constraints.push(orderBy('publishedAt', 'desc'))
  }
  constraints.push(fsLimit(options.max ?? 48))
  const snap = await getDocs(query(collection(db, PRODUCTS), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
}

/** A creator's public storefront — used by the creator profile tabs. */
export async function listCreatorPublished(ownerId: string): Promise<{ artworks: Artwork[]; products: Product[] }> {
  const [art, prod] = await Promise.all([
    getDocs(
      query(
        collection(db, ARTWORKS),
        where('ownerId', '==', ownerId),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        fsLimit(48),
      ),
    ),
    getDocs(
      query(
        collection(db, PRODUCTS),
        where('ownerId', '==', ownerId),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        fsLimit(48),
      ),
    ),
  ])
  return {
    artworks: art.docs.map((d) => ({ id: d.id, ...d.data() }) as Artwork),
    products: prod.docs.map((d) => ({ id: d.id, ...d.data() }) as Product),
  }
}
