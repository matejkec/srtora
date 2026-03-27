import type {
  TranslationMemory,
  StoredTerm,
  StoredSpeaker,
  CorrectionEntry,
} from '@srtora/types'

const DB_NAME = 'srtora-translation-memory'
const DB_VERSION = 1
const TERMS_STORE = 'terms'
const SPEAKERS_STORE = 'speakers'
const CORRECTIONS_STORE = 'corrections'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(TERMS_STORE)) {
        const termStore = db.createObjectStore(TERMS_STORE, { keyPath: ['source', 'languagePair'] })
        termStore.createIndex('languagePair', 'languagePair', { unique: false })
      }

      if (!db.objectStoreNames.contains(SPEAKERS_STORE)) {
        db.createObjectStore(SPEAKERS_STORE, { keyPath: 'label' })
      }

      if (!db.objectStoreNames.contains(CORRECTIONS_STORE)) {
        const corrStore = db.createObjectStore(CORRECTIONS_STORE, { autoIncrement: true })
        corrStore.createIndex('languagePair', 'languagePair', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txGet<T>(db: IDBDatabase, storeName: string, query?: IDBValidKey | IDBKeyRange): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = query !== undefined
      ? store.index('languagePair').getAll(query)
      : store.getAll()

    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

function txGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

function txPutAll<T>(db: IDBDatabase, storeName: string, items: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    for (const item of items) {
      store.put(item)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function txClear(db: IDBDatabase, storeNames: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite')
    for (const name of storeNames) {
      tx.objectStore(name).clear()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function txCount(db: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.count()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export interface TranslationMemoryStore {
  getMemory(languagePair: string): Promise<TranslationMemory>
  addTerms(terms: StoredTerm[]): Promise<void>
  addSpeakers(speakers: StoredSpeaker[]): Promise<void>
  addCorrections(corrections: CorrectionEntry[]): Promise<void>
  clearMemory(languagePair?: string): Promise<void>
  getStats(): Promise<{ termCount: number; speakerCount: number; correctionCount: number }>
}

export function createTranslationMemoryStore(): TranslationMemoryStore {
  let dbPromise: Promise<IDBDatabase> | null = null

  function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = openDB()
    }
    return dbPromise
  }

  return {
    async getMemory(languagePair: string): Promise<TranslationMemory> {
      const db = await getDB()

      const [terms, speakers, corrections] = await Promise.all([
        txGet<StoredTerm>(db, TERMS_STORE, languagePair),
        txGetAll<StoredSpeaker>(db, SPEAKERS_STORE),
        txGet<CorrectionEntry>(db, CORRECTIONS_STORE, languagePair),
      ])

      return {
        version: 1,
        terms,
        speakers,
        corrections,
      }
    },

    async addTerms(terms: StoredTerm[]): Promise<void> {
      if (terms.length === 0) return
      const db = await getDB()
      await txPutAll(db, TERMS_STORE, terms)
    },

    async addSpeakers(speakers: StoredSpeaker[]): Promise<void> {
      if (speakers.length === 0) return
      const db = await getDB()
      await txPutAll(db, SPEAKERS_STORE, speakers)
    },

    async addCorrections(corrections: CorrectionEntry[]): Promise<void> {
      if (corrections.length === 0) return
      const db = await getDB()
      await txPutAll(db, CORRECTIONS_STORE, corrections)
    },

    async clearMemory(): Promise<void> {
      const db = await getDB()
      await txClear(db, [TERMS_STORE, SPEAKERS_STORE, CORRECTIONS_STORE])
    },

    async getStats(): Promise<{ termCount: number; speakerCount: number; correctionCount: number }> {
      const db = await getDB()
      const [termCount, speakerCount, correctionCount] = await Promise.all([
        txCount(db, TERMS_STORE),
        txCount(db, SPEAKERS_STORE),
        txCount(db, CORRECTIONS_STORE),
      ])
      return { termCount, speakerCount, correctionCount }
    },
  }
}
