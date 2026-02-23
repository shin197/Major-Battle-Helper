// contents/inject/hijack.ts
export function stealWebpackRequire(): any | null {
  const chunks = (window as any).webpackChunkccfolia
  if (!chunks?.push) return null

  try {
    chunks.push([
      [999999],
      {},
      (require: any) => {
        window.webpackRequire = require
      }
    ])
    return window.webpackRequire
  } catch {
    return null
  }
}

export function stealReduxStore(): any | null {
  const root = document.getElementById("root")
  if (!root) return null

  const fk = Object.keys(root).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")
  )
  if (!fk) return null

  let fiber = (root as any)[fk]
  let depth = 0

  while (fiber && depth < 80) {
    const store = fiber.memoizedProps?.value?.store
    if (store?.getState) return store
    fiber = fiber.child || fiber.sibling || fiber.return?.sibling
    depth++
  }
  return null
}

// ... (findModuleIdByExportShape, resolveFirestoreTools, resolveDb, resolveSelectors 등 기존 모듈 탐색 로직을 모두 여기에 복사합니다) ...
// 편의상 생략된 나머지 후킹 관련 함수들(pickFirestoreExports 등)도 이곳에 포함시킵니다.

export function getServices() {
  const store = window.__MY_REDUX || stealReduxStore()
  const req = window.webpackRequire || stealWebpackRequire()

  if (!store) throw new Error("Redux Store를 찾을 수 없습니다.")
  if (!req) throw new Error("Webpack Require를 찾을 수 없습니다.")

  // 모듈 탐색 함수들은 이 파일 내의 함수를 호출합니다.
  const fsTools = resolveFirestoreTools(req)
  const db = resolveDb(req)
  const selectors = resolveSelectors(req)
  const roomItemActions = resolveRoomActions(req)
  const roomActions = resolveRoomActions(req) // 👈 마커/룸 액션 탈취

  const state = store.getState()
  const roomId = state.app?.state?.roomId
  const rc = state.entities?.roomCharacters

  if (!roomId || !rc)
    throw new Error("방 데이터(RoomID/Characters)를 읽을 수 없습니다.")

  return {
    store,
    req,
    fsTools,
    db,
    selectors,
    roomItemActions,
    roomActions,
    roomId,
    rc
  }
}

// --- 3. 모듈 탐색 로직 (기존 작동 코드 유지) ---

function findModuleIdByExportShape(
  req: any,
  predicate: (exp: any) => boolean
): number | null {
  const m = req?.m
  if (!m) return null

  const ids = Object.keys(m)
  for (const idStr of ids) {
    const id = Number(idStr)
    if (!Number.isFinite(id)) continue

    try {
      const exp = req(id)
      if (predicate(exp)) return id
    } catch {
      // 실행 중 에러/부작용 가능 모듈은 스킵
    }
  }
  return null
}

function resolveFirestoreTools(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  const cachedFsId = window.__CCFOLIA_MOD_CACHE__!.fsId
  if (cachedFsId != null) {
    try {
      const mod = req(cachedFsId)
      const tools = pickFirestoreExports(mod)
      if (tools) return tools
    } catch {
      // 캐시 깨짐
    }
  }

  const fsId = findModuleIdByExportShape(
    req,
    (mod) => !!pickFirestoreExports(mod)
  )

  if (fsId == null) throw new Error("Firestore SDK 모듈 탐색 실패")

  window.__CCFOLIA_MOD_CACHE__!.fsId = fsId
  const mod = req(fsId)
  const tools = pickFirestoreExports(mod)
  if (!tools) throw new Error("Firestore SDK 매핑 실패")
  return tools
}

function pickFirestoreExports(mod: any): null | {
  setDoc: Function
  doc: Function
  collection: Function
  deleteDoc: Function
  writeBatch: Function
} {
  if (!mod || typeof mod !== "object") return null

  let setDoc, doc, collection, deleteDoc, writeBatch

  // 1. 동적 탐색 (자동)
  // console.log("[Firestore Hijack] 모듈 탐색 중...")
  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function") {
      const fnStr = val.toString()

      if (fnStr.includes('"setDoc"')) {
        setDoc = val
      } else if (fnStr.includes('"deleteDoc"')) {
        deleteDoc = val
      } else if (fnStr.includes('"writeBatch"')) {
        writeBatch = val
      } else if (fnStr.includes('"collection"')) {
        collection = val
      } else if (
        fnStr.includes('"doc"') &&
        !fnStr.includes('"setDoc"') &&
        !fnStr.includes('"deleteDoc"')
      ) {
        doc = val
      }
    }
  }

  // 2. 폴백 탐색 (수동)
  const candSetDoc = mod.pl ?? mod.setDoc
  const candDoc = mod.JU ?? mod.doc
  const candCollection = mod.hJ ?? mod.collection
  const candDeleteDoc = mod.oe ?? mod.deleteDoc
  const candWriteBatch = mod.qs ?? mod.writeBatch

  // 💡 3. 수정된 할당 로직: 동적으로 찾은 게 있으면 그거 쓰고, 없으면 폴백을 쓴다!
  setDoc = setDoc ?? (typeof candSetDoc === "function" ? candSetDoc : null)
  doc = doc ?? (typeof candDoc === "function" ? candDoc : null)
  collection =
    collection ?? (typeof candCollection === "function" ? candCollection : null)
  deleteDoc =
    deleteDoc ?? (typeof candDeleteDoc === "function" ? candDeleteDoc : null)
  writeBatch =
    writeBatch ?? (typeof candWriteBatch === "function" ? candWriteBatch : null)

  if (setDoc && doc && collection && deleteDoc && writeBatch) {
    return { setDoc, doc, collection, deleteDoc, writeBatch }
  }
  return null
}

function resolveDb(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  const cachedDbId = window.__CCFOLIA_MOD_CACHE__!.dbId
  if (cachedDbId != null) {
    try {
      const mod = req(cachedDbId)
      const db = pickDb(mod)
      if (db) return db
    } catch {}
  }

  const dbId = findModuleIdByExportShape(req, (mod) => !!pickDb(mod))
  if (dbId == null) throw new Error("DB 인스턴스 모듈 탐색 실패")

  window.__CCFOLIA_MOD_CACHE__!.dbId = dbId
  const mod = req(dbId)
  const db = pickDb(mod)
  if (!db) throw new Error("DB 인스턴스 추출 실패")
  return db
}

function pickDb(mod: any): any | null {
  if (!mod || typeof mod !== "object") return null
  if (mod.db && typeof mod.db === "object") return mod.db
  return null
}

function resolveSelectors(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  // 캐시 확인
  if (window.__CCFOLIA_MOD_CACHE__.selId) {
    const mod = req(window.__CCFOLIA_MOD_CACHE__.selId)
    if (pickSelectors(mod)) return mod
  }

  // 1. 알려진 ID(88464) 먼저 시도
  try {
    const mod = req(88464)
    if (pickSelectors(mod)) {
      window.__CCFOLIA_MOD_CACHE__.selId = 88464
      return mod
    }
  } catch {}

  // 2. 동적 탐색 (함수 이름 추정)
  const selId = findModuleIdByExportShape(req, (mod) => !!pickSelectors(mod))
  if (selId) {
    window.__CCFOLIA_MOD_CACHE__.selId = selId
    return req(selId)
  }

  return null // 못 찾아도 치명적이지 않음 (수동 구현으로 대체)
}

function pickSelectors(mod: any) {
  if (!mod) return null
  // 특징적인 함수 이름들이 존재하는지 확인
  return (
    typeof mod.getRoomCharacterIds === "function" &&
    typeof mod.getCharacterById === "function"
  )
}

function resolveRoomItemActions(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  // 0. 캐시 확인
  const cachedId = window.__CCFOLIA_MOD_CACHE__.riaId
  if (cachedId != null) {
    try {
      const mod = req(cachedId)
      if (pickRoomItemActions(mod)) return mod
    } catch {}
  }

  // 1. 알려진 ID(15290) 먼저 시도 (빠른 로딩)
  try {
    const mod = req(15290)
    if (pickRoomItemActions(mod)) {
      window.__CCFOLIA_MOD_CACHE__.riaId = 15290
      return mod
    }
  } catch {}

  // 2. 동적 탐색 (업데이트 대비 Fallback)
  const tcId = findModuleIdByExportShape(
    req,
    (mod) => !!pickRoomItemActions(mod)
  )
  if (tcId != null) {
    window.__CCFOLIA_MOD_CACHE__.riaId = tcId
    return req(tcId)
  }

  return null
}

function pickRoomItemActions(mod: any) {
  if (!mod || typeof mod !== "object") return null

  // 1. Webpack이 함수 이름을 보존한 경우
  if (typeof mod.addRoomItem === "function") return mod

  // 2. 난독화되어 이름이 바뀐 경우, 내부 문자열(Signature)로 탐색
  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function") {
      const fnStr = val.toString()
      // 코코포리아의 addRoomItem 함수만이 가지는 고유한 특징 문자열
      if (fnStr.includes('"update-item"') || fnStr.includes("getMaxZIndex")) {
        return mod
      }
    }
  }
  return null
}

function resolveRoomActions(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  // 0. 캐시 확인
  const cachedId = window.__CCFOLIA_MOD_CACHE__.raId
  if (cachedId != null) {
    try {
      const mod = req(cachedId)
      if (pickRoomActions(mod)) return mod
    } catch {}
  }

  // 1. 알려진 ID(69019) 먼저 시도
  try {
    const mod = req(69019)
    if (pickRoomActions(mod)) {
      window.__CCFOLIA_MOD_CACHE__.raId = 69019
      return mod
    }
  } catch {}

  // 2. 동적 탐색 (업데이트 대비 Fallback)
  // 원본 함수 내부에 있는 고유한 문자열 '"update-marker"'를 추적 단서로 사용합니다.
  const raId = findModuleIdByExportShape(req, pickRoomActions)
  if (raId != null) {
    window.__CCFOLIA_MOD_CACHE__.raId = raId
    return req(raId)
  }

  return null
}

function pickRoomActions(mod: any) {
  if (!mod || typeof mod !== "object") return null

  if (typeof mod.addRoomMarker === "function") return mod

  // 난독화된 경우 내부 문자열로 탐색
  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function") {
      const fnStr = val.toString()
      if (fnStr.includes('"update-marker"')) return mod
    }
  }
  return null
}
