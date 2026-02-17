import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  world: "MAIN",
  run_at: "document_idle"
}

// --- 1. 타입 정의 (Types) ---

interface CcfoliaStatus {
  label: string;
  value: number;
  max: number;
}

interface CcfoliaParam {
  label: string;
  value: string;
}

interface CcfoliaCharacter {
  _id: string;
  name: string;
  status: CcfoliaStatus[];
  params: CcfoliaParam[];
  active: boolean;    // 맵에 표시 여부
  secret: boolean;    // 비밀 여부
  invisible: boolean; // 투명 여부 (GM 전용)
  commands?: string;  // 채팅 팔레트
  [key: string]: any;
}

declare global {
  interface Window {
    webpackRequire: any
    __MY_REDUX: any
    ccfoliaAPI: any
    __CCFOLIA_MOD_CACHE__?: {
      fsId?: number
      dbId?: number
    }
  }
}

// --- 2. Webpack 및 Redux 탈취 (기존 작동 코드 유지) ---

function stealWebpackRequire(): any | null {
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

function stealReduxStore(): any | null {
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

  const fsId = findModuleIdByExportShape(req, (mod) => !!pickFirestoreExports(mod))
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
  deleteDoc?: Function // 삭제 기능 확장을 위해 추가
} {
  if (!mod || typeof mod !== "object") return null

  const candSetDoc = mod.pl ?? mod.setDoc
  const candDoc = mod.JU ?? mod.doc
  const candCollection = mod.hJ ?? mod.collection
  const candDeleteDoc = mod.oe ?? mod.deleteDoc // deleteDoc 추정

  const setDoc = typeof candSetDoc === "function" ? candSetDoc : null
  const doc = typeof candDoc === "function" ? candDoc : null
  const collection = typeof candCollection === "function" ? candCollection : null
  const deleteDoc = typeof candDeleteDoc === "function" ? candDeleteDoc : null

  if (setDoc && doc && collection) return { setDoc, doc, collection, deleteDoc }
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

// --- 4. 헬퍼 함수 ---

function getServices() {
    const store = window.__MY_REDUX || stealReduxStore()
    const req = window.webpackRequire || stealWebpackRequire()
    
    if (!store) throw new Error("Redux Store를 찾을 수 없습니다.")
    if (!req) throw new Error("Webpack Require를 찾을 수 없습니다.")
    
    // 모듈 동적 로드
    const fsTools = resolveFirestoreTools(req)
    const dbInstance = resolveDb(req)
    
    // 현재 방 정보
    const state = store.getState()
    const roomId = state.app?.state?.roomId
    const rc = state.entities?.roomCharacters
    
    if (!roomId || !rc) throw new Error("방 데이터(RoomID/Characters)를 읽을 수 없습니다.")
    
    return {
        store,
        req,
        fsTools,
        db: dbInstance,
        roomId,
        rc
    }
}

// --- 5. 강력해진 API 구현 ---

function initCCfoliaAPI() {
  // 초기화 시도
  try {
      stealWebpackRequire()
      window.__MY_REDUX = stealReduxStore()
  } catch(e) {}

  window.ccfoliaAPI = {
    
    /**
     * 캐릭터 이름(일부)으로 캐릭터 객체 찾기
     */
    getChar: (namePart: string): CcfoliaCharacter | undefined => {
      const { rc } = getServices()
      return rc.ids.map((id: string) => rc.entities[id])
                   .find((c: CcfoliaCharacter) => c.name?.includes(namePart))
    },

    /**
     * 캐릭터의 특정 스테이터스(HP, MP, SAN 등) 값 변경
     * - namePart: 캐릭터 이름
     * - labelPart: 스테이터스 라벨 (예: "HP", "정신력")
     * - valueDiff: 더할 값 (음수면 뺌)
     */
    setStatus: async (namePart: string, labelPart: string, valueDiff: number) => {
      const { fsTools, db, roomId, rc } = getServices()
      const { setDoc, doc, collection } = fsTools
      
      const target = window.ccfoliaAPI.getChar(namePart)
      if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

      const newStatus = target.status.map(s => {
        if (s.label.includes(labelPart)) {
            // 최대값/최소값 보정 (선택사항)
            let val = s.value + valueDiff
            if (val < 0) val = 0 
            if (val > s.max) val = s.max
            return { ...s, value: val }
        }
        return s
      })

      const targetRef = doc(collection(db, "rooms", roomId, "characters"), target._id)
      await setDoc(targetRef, { status: newStatus, updatedAt: Date.now() }, { merge: true })
      console.log(`[API] ${target.name}: ${labelPart} ${valueDiff > 0 ? '+' : ''}${valueDiff}`)
    },

    /**
     * 캐릭터의 파라미터(텍스트) 변경 (STR, DEX, 메모 등)
     * - newValue: 문자열로 입력해야 함
     */
    setParam: async (namePart: string, labelPart: string, newValue: string) => {
        const { fsTools, db, roomId } = getServices()
        const { setDoc, doc, collection } = fsTools

        const target = window.ccfoliaAPI.getChar(namePart)
        if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

        const newParams = target.params.map(p => {
            if (p.label === labelPart) {
                return { ...p, value: newValue }
            }
            return p
        })

        const targetRef = doc(collection(db, "rooms", roomId, "characters"), target._id)
        await setDoc(targetRef, { params: newParams, updatedAt: Date.now() }, { merge: true })
        console.log(`[API] ${target.name}: ${labelPart} -> ${newValue}`)
    },

    /**
     * 캐릭터 속성 토글 (맵 표시, 투명화, 비밀 등)
     * - prop: 'active' | 'invisible' | 'secret'
     */
    toggleProp: async (namePart: string, prop: 'active' | 'invisible' | 'secret') => {
        const { fsTools, db, roomId } = getServices()
        const { setDoc, doc, collection } = fsTools

        const target = window.ccfoliaAPI.getChar(namePart)
        if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

        const newValue = !target[prop]
        const targetRef = doc(collection(db, "rooms", roomId, "characters"), target._id)
        
        const payload: any = { updatedAt: Date.now() }
        payload[prop] = newValue

        await setDoc(targetRef, payload, { merge: true })
        console.log(`[API] ${target.name}: ${prop} -> ${newValue}`)
    },

    /**
     * 캐릭터 채팅 명령어(Palette) 수정
     */
    setCommands: async (namePart: string, newCommands: string) => {
        const { fsTools, db, roomId } = getServices()
        const { setDoc, doc, collection } = fsTools

        const target = window.ccfoliaAPI.getChar(namePart)
        if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

        const targetRef = doc(collection(db, "rooms", roomId, "characters"), target._id)
        await setDoc(targetRef, { commands: newCommands, updatedAt: Date.now() }, { merge: true })
        console.log(`[API] ${target.name}: 명령어 수정 완료`)
    },

    /**
     * 디버그용: 현재 캐릭터 전체 정보 덤프
     */
    inspect: (namePart: string) => {
        const char = window.ccfoliaAPI.getChar(namePart)
        console.log(`[API] Inspect '${namePart}':`, char)
        return char
    }
  }

  console.log("%c[CCFOLIA-API] 인젝트 완료")

// --- 7. 테스트 코드 (요청하신 부분) ---
  // 페이지 로드 3초 후 실행됩니다.
  setTimeout(async () => {
    console.log("[CCFOLIA-API] 10초 경과: 테스트 자동 실행 시도...")
    
    // ★ 여기에 테스트하고 싶은 캐릭터 이름을 적으세요
    const targetName = "크시카" 
    
    try {
        const char = window.ccfoliaAPI.getChar(targetName)
        if (char) {
            console.log(`[TEST] 타겟 발견: ${char.name}`)
            
            // 예시: HP를 1 깎습니다.
            // await window.ccfoliaAPI.setStatus(targetName, "HP", -1)
            
            // 예시: 투명화를 토글해봅니다. (필요없으면 주석처리)
            // await window.ccfoliaAPI.toggleProp(targetName, "invisible")
            
            console.log("[TEST] 테스트 동작 완료!")
        } else {
            console.warn(`[TEST] 이름에 '${targetName}'가 포함된 캐릭터를 찾지 못했습니다.`)
        }
    } catch (e) {
        console.error("[TEST] 테스트 중 에러 발생:", e)
    }
  }, 10000)
}

// 실행
initCCfoliaAPI()