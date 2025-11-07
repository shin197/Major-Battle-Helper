// localStorage 전용 동기 스토어 (await 없음)
// 파일명: characterStore.simple.ts

// ===== 타입 =====
export type CharacterData = {
  name: string
  initiative: number
  iconUrl: string
  faces: { iconUrl: string; label: string }[]
  status: { label: string; cur: number; max: number }[]
  params: { label: string; value: string }[]
}

export type CharacterRecord = {
  id: string
  data: CharacterData
  updatedAt: number
  source: "scan" | "manual" | "api"
  hash?: string
}

type StoreShape = {
  version: number
  index: string[]
  byId: Record<string, CharacterRecord>
}

const STORE_VERSION = 1
const ROOT_KEY = "ccf:characters:v1"

// ===== 유틸 =====
function debounce<F extends (...args: any[]) => void>(fn: F, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<F>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

function loadFromLocal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function saveToLocal<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 용량 초과 등은 조용히 무시 (필요시 console.warn)
  }
}

// 라벨 기반 병합(옵션)
function mergeByLabel<T extends { label: string }>(
  oldArr: T[],
  newArr: T[],
  combiner?: (oldItem: T, newItem?: T) => T
): T[] {
  const byLabel = new Map<string, T>()
  for (const o of oldArr) byLabel.set(o.label, o)
  for (const n of newArr) {
    if (byLabel.has(n.label)) {
      byLabel.set(n.label, combiner ? combiner(byLabel.get(n.label)!, n) : n)
    } else {
      byLabel.set(n.label, n)
    }
  }
  return Array.from(byLabel.values())
}

function mergeCharacter(
  oldD: CharacterData,
  newD: CharacterData
): CharacterData {
  const faces = mergeByLabel(oldD.faces, newD.faces)
  const status = mergeByLabel(oldD.status, newD.status, (a, b) => ({
    label: a.label,
    cur: b?.cur ?? a.cur,
    max: b?.max ?? a.max
  }))
  const params = mergeByLabel(oldD.params, newD.params, (a, b) => ({
    label: a.label,
    value: b?.value ?? a.value
  }))
  return {
    name: newD.name ?? oldD.name,
    initiative: (newD.initiative as number) ?? oldD.initiative,
    iconUrl: newD.iconUrl || oldD.iconUrl,
    faces,
    status,
    params
  }
}

export function makeCharacterIdFromName(name: string) {
  const h = new TextEncoder()
    .encode(name)
    .reduce((acc, c) => ((acc << 5) - acc + c) | 0, 0)
    .toString(16)
  return `name:${name}:${h}`
}

// ===== 동기 스토어 =====
export class CharacterStore {
  private cache: StoreShape
  private dirty = false
  private flushDebounced: () => void

  constructor() {
    const loaded = loadFromLocal<StoreShape>(ROOT_KEY)
    if (!loaded) {
      this.cache = { version: STORE_VERSION, index: [], byId: {} }
    } else {
      this.cache =
        loaded.version === STORE_VERSION ? loaded : this.migrate(loaded)
    }
    // 150ms 지연 저장으로 I/O 절약
    this.flushDebounced = debounce(() => this.flush(), 150)
  }

  private migrate(oldStore: StoreShape): StoreShape {
    // 필요한 변환이 생기면 추가
    const migrated: StoreShape = {
      version: STORE_VERSION,
      index: oldStore.index ?? [],
      byId: oldStore.byId ?? {}
    }
    // 마이그레이션 즉시 저장
    saveToLocal(ROOT_KEY, migrated)
    return migrated
  }

  private markDirty() {
    this.dirty = true
    this.flushDebounced()
  }

  /** 즉시 저장 */
  flush() {
    if (!this.dirty) return
    saveToLocal(ROOT_KEY, this.cache)
    this.dirty = false
  }

  // ===== CRUD (모두 동기) =====

  list(): CharacterRecord[] {
    return this.cache.index.map((id) => this.cache.byId[id])
  }

  get(id: string): CharacterRecord | null {
    return this.cache.byId[id] ?? null
  }

  getByName(name: string): CharacterRecord | null {
    const items = Object.values(this.cache.byId).filter(
      (r) => r.data.name === name
    )
    if (items.length === 0) return null
    items.sort((a, b) => b.updatedAt - a.updatedAt)
    return items[0]
  }

  upsert(input: {
    id: string
    data: CharacterData
    source?: CharacterRecord["source"]
    hash?: string
    merge?: boolean
  }): CharacterRecord {
    const { id, data, source = "scan", hash, merge = false } = input
    const prev = this.cache.byId[id]
    const record: CharacterRecord = {
      id,
      data: merge && prev ? mergeCharacter(prev.data, data) : data,
      updatedAt: Date.now(),
      source,
      hash
    }
    this.cache.byId[id] = record
    if (!this.cache.index.includes(id)) this.cache.index.push(id)
    this.markDirty()
    return record
  }

  patch(
    id: string,
    patch: Partial<CharacterData>,
    source: CharacterRecord["source"] = "manual"
  ): CharacterRecord | null {
    const prev = this.cache.byId[id]
    if (!prev) return null
    const next: CharacterRecord = {
      ...prev,
      data: { ...prev.data, ...patch },
      source,
      updatedAt: Date.now()
    }
    this.cache.byId[id] = next
    this.markDirty()
    return next
  }

  remove(id: string): boolean {
    if (!this.cache.byId[id]) return false
    delete this.cache.byId[id]
    this.cache.index = this.cache.index.filter((x) => x !== id)
    this.markDirty()
    return true
  }

  clear() {
    this.cache = { version: STORE_VERSION, index: [], byId: {} }
    saveToLocal(ROOT_KEY, this.cache)
    this.dirty = false
  }
}

export const store = new CharacterStore()
