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
  const roomItemActions = resolveRoomItemActions(req)
  const roomActions = resolveRoomActions(req) // 👈 마커/룸 액션 탈취
  const appActions = resolveAppActions(req) // 👈 앱(App) 액션 탈취
  const deckActions = resolveDeckActions(req) // 👈 덱(Deck) 액션 탈취
  const diceActions = resolveDiceActions(req) // 👈 주사위(Dice) 액션 탈취

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
    appActions,
    deckActions,
    diceActions,
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
  addDoc: Function
  updateDoc: Function
} {
  if (!mod || typeof mod !== "object") return null

  let setDoc, doc, collection, deleteDoc, writeBatch, addDoc, updateDoc

  // 1. 객체의 모든 속성을 순회하며 함수형태인 것들만 검사
  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function") {
      const fnStr = val.toString()
      const fnName = val.name || ""

      if (fnStr.includes('"deleteDoc"') || fnName === "deleteDoc") {
        deleteDoc = val
      } else if (fnStr.includes('"writeBatch"') || fnName === "writeBatch") {
        writeBatch = val
      } else if (fnStr.includes('"collection"') || fnName === "collection") {
        collection = val
      } else if (fnStr.includes('"updateDoc"') || fnName === "updateDoc") {
        updateDoc = val
      } else if (
        (fnStr.includes('"doc"') || fnName === "doc") &&
        !fnStr.includes('"setDoc"') &&
        !fnStr.includes('"addDoc"') &&
        !fnStr.includes('"deleteDoc"') &&
        !fnStr.includes('"updateDoc"')
      ) {
        doc = val
      }
    }
  }

  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function" && val !== collection && val !== doc && val !== deleteDoc && val !== writeBatch && val !== updateDoc) {
      try {
        if (val.toString().includes('merge')) {
          setDoc = val
        } else if (val.toString().includes('"addDoc"') || val.name === "addDoc") {
          addDoc = val
        }
      } catch (e) { }
    }
  }

  // 2. 동적 탐색 실패 시 알려진 Fallback
  setDoc = setDoc ?? mod.pl ?? mod.setDoc
  doc = doc ?? mod.JU ?? mod.doc
  collection = collection ?? mod.hJ ?? mod.collection
  deleteDoc = deleteDoc ?? mod.oe ?? mod.deleteDoc
  writeBatch = writeBatch ?? mod.qs ?? mod.writeBatch
  addDoc = addDoc ?? mod.addDoc
  updateDoc = updateDoc ?? mod.updateDoc ?? mod.Fv // fallback for updateDoc may not be perfect, but we try

  // updateDoc도 반환에 추가
  if (setDoc && doc && collection && deleteDoc && addDoc) {
    return { setDoc, doc, collection, deleteDoc, writeBatch, addDoc, updateDoc }
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
    } catch { }
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
  } catch { }

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
    } catch { }
  }

  // 1. 알려진 ID(15290) 먼저 시도 (빠른 로딩)
  try {
    const mod = req(15290)
    if (pickRoomItemActions(mod)) {
      window.__CCFOLIA_MOD_CACHE__.riaId = 15290
      return mod
    }
  } catch { }

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
    } catch { }
  }

  // 1. 알려진 ID(69019) 먼저 시도
  try {
    const mod = req(23728)
    if (pickRoomActions(mod)) {
      window.__CCFOLIA_MOD_CACHE__.raId = 23728
      return mod
    }
  } catch { }

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

function resolveAppActions(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  // 0. 캐시 확인
  const cachedId = window.__CCFOLIA_MOD_CACHE__.appActionsId
  if (cachedId != null) {
    try {
      const mod = req(cachedId)
      if (pickAppActions(mod)) return mod
    } catch { }
  }

  // 1. 알려진 ID(99093) 먼저 시도 (사용자 제공)
  try {
    const mod = req(99093)
    if (pickAppActions(mod)) {
      window.__CCFOLIA_MOD_CACHE__.appActionsId = 99093
      return mod
    }
  } catch { }

  // 2. 동적 탐색 (Fallback)
  const appActionsId = findModuleIdByExportShape(req, pickAppActions)
  if (appActionsId != null) {
    window.__CCFOLIA_MOD_CACHE__.appActionsId = appActionsId
    return req(appActionsId)
  }

  return null
}

function pickAppActions(mod: any) {
  if (!mod || typeof mod !== "object") return null

  if (typeof mod.appStateMutate === "function") return mod

  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function") {
      const fnStr = val.toString()
      // appStateMutate 관련 문자열 특징이 있다면 식별 (일단 export 키워드에 appStateMutate가 있을 확률이 높음)
      if (fnStr.includes("selectedObjects") && fnStr.includes("state")) {
        // rough guess if minified
      }
    }
  }
  // If minified and we can't easily find it, rely on the exact ID 99093
  return null
}

function resolveDeckActions(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  const cachedId = window.__CCFOLIA_MOD_CACHE__.deckActionsId
  if (cachedId != null) {
    try {
      const mod = req(cachedId)
      if (pickDeckActions(mod)) return mod
    } catch { }
  }

  try {
    const mod = req(72696)
    if (pickDeckActions(mod)) {
      window.__CCFOLIA_MOD_CACHE__.deckActionsId = 72696
      return mod
    }
  } catch { }

  const deckActionsId = findModuleIdByExportShape(req, pickDeckActions)
  if (deckActionsId != null) {
    window.__CCFOLIA_MOD_CACHE__.deckActionsId = deckActionsId
    return req(deckActionsId)
  }

  return null
}

function pickDeckActions(mod: any) {
  if (!mod || typeof mod !== "object") return null

  if (typeof mod.addRoomDeck === "function" || typeof mod.updateRoomDeck === "function") return mod

  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function") {
      const fnStr = val.toString()
      if (fnStr.includes('"update-deck"') || fnStr.includes("createPlayingCards")) {
        return mod
      }
    }
  }
  return null
}

function resolveDiceActions(req: any) {
  window.__CCFOLIA_MOD_CACHE__ ??= {}

  const cachedId = window.__CCFOLIA_MOD_CACHE__.diceActionsId
  if (cachedId != null) {
    try {
      const mod = req(cachedId)
      if (pickDiceActions(mod)) return mod
    } catch { }
  }

  try {
    const mod = req(67342)
    if (pickDiceActions(mod)) {
      window.__CCFOLIA_MOD_CACHE__.diceActionsId = 67342
      return mod
    }
  } catch { }

  const diceActionsId = findModuleIdByExportShape(req, pickDiceActions)
  if (diceActionsId != null) {
    window.__CCFOLIA_MOD_CACHE__.diceActionsId = diceActionsId
    return req(diceActionsId)
  }

  return null
}

function pickDiceActions(mod: any) {
  if (!mod || typeof mod !== "object") return null

  if (typeof mod.addRoomDice === "function" || typeof mod.updateRoomDice === "function") return mod

  for (const key of Object.keys(mod)) {
    const val = mod[key]
    if (typeof val === "function") {
      const fnStr = val.toString()
      if (fnStr.includes('"update-dice"') || fnStr.includes("updateRollRoomDice")) {
        return mod
      }
    }
  }
  return null
}
