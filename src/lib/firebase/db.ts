import { getFirestore, type Firestore } from 'firebase/firestore'
import app from './config'

// Firestore lives in its own module (not config.ts) so the heavy
// firebase/firestore SDK stays OUT of the root client bundle — it is
// loaded only by route chunks that actually read/write data.
export const db: Firestore = getFirestore(app)
