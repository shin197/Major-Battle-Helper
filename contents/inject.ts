import type { PlasmoCSConfig } from "plasmo"
import { generateRandomId } from "~utils/utils";

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
      selId?: number
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
  return typeof mod.getRoomCharacterIds === 'function' && typeof mod.getCharacterById === 'function'
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
    const selectors = resolveSelectors(req) // 선택적 로드
    
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
        selectors,
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
    
    getCharacters: (filterType: 'all' | 'active' | 'mine' = 'all'): CcfoliaCharacter[] => {
      const { store, selectors, rc } = getServices()
      const state = store.getState()

      // 1. Selector 모듈을 찾았다면 활용 (더 정확함)
      if (selectors) {
        let ids: string[] = []
        if (filterType === 'active') ids = selectors.getRoomActiveCharacterIds(state)
        else if (filterType === 'mine') ids = selectors.getMyRoomCharacterIds(state)
        else ids = selectors.getRoomCharacterIds(state) // all
        return ids.map(id => rc.entities[id]).filter(Boolean)
      } 
      
      // 2. 못 찾았다면 수동 필터링 (Fallback)
      else {
        let chars = rc.ids.map((id: string) => rc.entities[id])
        if (filterType === 'active') chars = chars.filter((c: any) => c.active)
        if (filterType === 'mine') {
           const myUid = state.app.state.uid // 현재 내 UID
           chars = chars.filter((c: any) => c.owner === myUid)
        }
        return chars
      }
    },

    createCharacter: async (sourceName?: string) => {
      const { fsTools, db, roomId, store } = getServices()
      const { setDoc, doc, collection } = fsTools
      const state = store.getState()
      
      // 컬렉션 참조에서 새로운 ID 자동 생성
      const colRef = collection(db, "rooms", roomId, "characters")
      // Firestore v9 방식: doc(colRef)를 호출하면 랜덤 ID를 가진 참조 생성
      // 하지만 minified된 doc함수가 인자 1개를 지원하는지 불확실하므로, 
      // 안전하게 랜덤 ID를 직접 만들거나 기존 캐릭터를 복사함.
      
      // 1. 템플릿 준비
      let template: any = {
          name: "New Character",
          status: [{ label: "HP", value: 10, max: 10 }],
          params: [{ label: "MEMO", value: "" }],
          active: true,
          secret: false,
          invisible: false,
          owner: state.app.state.uid, // 내 캐릭터로 생성
          createdAt: Date.now(),
          updatedAt: Date.now()
      }

      if (sourceName) {
          const source = window.ccfoliaAPI.getCharacters('all').find((c:any) => c.name.includes(sourceName))
          if (source) {
              template = { ...source }
              delete template._id // ID는 새로 따야 함
              template.name = source.name + " (Copy)"
              template.createdAt = Date.now()
          }
      }

      // 2. 새 문서 생성 (ID는 setDoc이 아닌 doc()에서 생성해야 하지만, 여기선 임의 ID 생성 로직 사용)
      // 코코포리아는 20자리 랜덤 문자열 ID를 사용함.
      const newId = generateRandomId() 
      const newRef = doc(colRef, newId)
      
      await setDoc(newRef, template)
      console.log(`[API] 캐릭터 생성 완료: ${template.name}`)
    },
        
    /**
     * [삭제] 캐릭터 삭제
     */
    deleteCharacter: async (namePart: string) => {
      const { fsTools, db, roomId } = getServices()
      const { doc, collection, deleteDoc } = fsTools // deleteDoc 사용

      if (!deleteDoc) throw new Error("deleteDoc 함수를 찾을 수 없습니다.")

      const target = window.ccfoliaAPI.getCharacters('all').find((c: any) => c.name.includes(namePart))
      if (!target) throw new Error(`'${namePart}' 캐릭터 없음`)
      
      if (!confirm(`정말 '${target.name}' 캐릭터를 삭제하시겠습니까?`)) return

      const ref = doc(collection(db, "rooms", roomId, "characters"), target._id)
      await deleteDoc(ref)
      console.log(`[API] ${target.name} 삭제 완료`)
    },

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
            // if (val < 0) val = 0 
            // if (val > s.max) val = s.max
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
     * [NEW] 룸 아이템(스크린 패널, 마커 등) 관련 API
     */
    items: {
      /**
       * 1. 현재 룸의 모든 아이템 리스트 가져오기
       * - provided file의 'state.entities.roomItems.entities' 참조
       */
      getAll: () => {
        const { store } = getServices();
        const state = store.getState();
        const roomItems = state.entities.roomItems;
        if (!roomItems) return [];
        
        // 정렬된 ID 순서대로 객체 배열 반환 (Z-index 순서일 가능성 높음)
        // provided file의 'getSortedRoomItemIds' 로직 대체
        return roomItems.ids.map((id: string) => roomItems.entities[id]);
      },

      /**
       * 2. 특정 ID의 아이템 정보 가져오기
       */
      getById: (itemId: string) => {
        const { store } = getServices();
        const state = store.getState();
        return state.entities.roomItems.entities[itemId];
      },

      /**
       * 3. 마우스 호버링 인스펙터 (토글)
       * 실행하면 마우스를 움직일 때마다 콘솔에 해당 위치의 아이템 정보를 띄웁니다.
       * 다시 실행하면 꺼집니다.
       */
      toggleInspector: () => {
        if ((window as any).__CCFOLIA_INSPECTOR_ACTIVE) {
          // 끄기
          document.removeEventListener("mousemove", hoverHandler);
          document.removeEventListener("click", clickHandler);
          (window as any).__CCFOLIA_INSPECTOR_ACTIVE = false;
          console.log("%c[API] 🕵️‍♂️ 아이템 인스펙터 OFF", "color: gray");
        } else {
          // 켜기
          document.addEventListener("mousemove", hoverHandler);
          document.addEventListener("click", clickHandler);
          (window as any).__CCFOLIA_INSPECTOR_ACTIVE = true;
          console.log("%c[API] 🕵️‍♂️ 아이템 인스펙터 ON - 아이템 위에 마우스를 올리세요.", "color: lime");
        }
      }
    },

    /**
     * 디버그용: 현재 캐릭터 전체 정보 덤프
     */
    inspect: (namePart: string) => {
        const char = window.ccfoliaAPI.getChar(namePart)
        console.log(`[API] Inspect '${namePart}':`, char)
        return char
    },

    /**
   * [개발자 도구] 모듈 탐험 및 분석용 도구 모음
   */
    devtools: {
      /**
       * 1. 특정 모듈 ID의 내용물을 콘솔에 출력합니다.
       * 사용법: ccfoliaAPI.devtools.inspect(51784)
       */
      inspect: (moduleId: number) => {
        try {
          const req = window.webpackRequire;
          if (!req) throw new Error("WebpackRequire 없음");
          
          const mod = req(moduleId);
          console.group(`📦 Module [${moduleId}] Inspector`);
          console.log("Exported Value:", mod);
          
          // 함수 목록만 따로 보여주기 (Signature 확인용)
          if (typeof mod === 'object') {
              console.groupCollapsed("Functions List");
              Object.entries(mod).forEach(([key, val]) => {
                  if (typeof val === 'function') {
                      console.log(`${key}:`, val.toString().slice(0, 50) + "...");
                  }
              });
              console.groupEnd();
          }
          console.groupEnd();
          return mod;
        } catch (e) {
          console.error(`모듈 ${moduleId} 로드 실패:`, e);
        }
      },

      /**
       * 2. 키워드로 모든 모듈을 검색합니다. (보물 찾기!)
       * 사용법: ccfoliaAPI.devtools.search("PlaySound")
       * 주의: 너무 짧은 키워드는 결과가 많을 수 있습니다.
       */
      search: (keyword: string) => {
        const req = window.webpackRequire;
        const modules = req.m; // 모듈 팩토리 배열
        const results: Record<string, any> = {};

        console.log(`🔎 "${keyword}" 검색 시작...`);
        
        for (const id in modules) {
          try {
            // 모듈 소스코드(문자열)에서 검색 (로딩 전 탐색)
            const source = modules[id].toString();
            if (source.includes(keyword)) {
              console.log(`FOUND in Source [${id}]`);
              // 안전하게 로드 시도
              try { results[id] = req(id); } catch { results[id] = "(Load Error)"; }
            }
          } catch (e) {}
        }
        
        console.log("검색 결과:", results);
        return results;
      },

      /**
       * 3. 현재 로드된 모든 모듈의 ID 목록을 봅니다.
       */
      listAll: () => {
          console.log("Available Modules:", Object.keys(window.webpackRequire.m));
      }
    }
  }


const findReactProps = (dom: HTMLElement): any => {
    const key = Object.keys(dom).find(k => k.startsWith("__reactFiber$"));
    // @ts-ignore
    return key ? dom[key] : null;
  };

  // React Fiber 트리를 타고 올라가며 itemId를 가진 컴포넌트 찾기
  const findItemIdFromDom = (target: HTMLElement | null): string | null => {
    let curr = target;
    while (curr && curr !== document.body) {
      const fiber = findReactProps(curr);
      if (fiber) {
        let node = fiber;
        while (node) {
            // 1. props에 item 객체가 통째로 있는 경우
            if (node.memoizedProps?.item?._id) return node.memoizedProps.item._id;
            // 2. props에 itemId가 있는 경우
            if (node.memoizedProps?.itemId) return node.memoizedProps.itemId;
            // 3. 'item-id' 같은 data attribute가 있는 경우
            if (node.memoizedProps?.["data-item-id"]) return node.memoizedProps["data-item-id"];
            
            node = node.return; // 부모 노드로 이동
        }
      }
      curr = curr.parentElement;
    }
    return null;
  };

  let lastHoveredId: string | null = null;

  const hoverHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const itemId = findItemIdFromDom(target);

    if (itemId && itemId !== lastHoveredId) {
      lastHoveredId = itemId;
      const item = window.ccfoliaAPI.items.getById(itemId);
      console.log(`%c[Found] ${item.name || "No Name"} (${itemId})`, "color: cyan", item);
      
      // 시각적 피드백 (선택사항: 테두리 표시 등)
      target.style.outline = "2px solid cyan";
      setTimeout(() => target.style.outline = "", 500);
    }
  };

  const clickHandler = (e: MouseEvent) => {
      // 클릭 시 해당 아이템 정보 고정 출력 (Deep copy)
      const target = e.target as HTMLElement;
      const itemId = findItemIdFromDom(target);
      if(itemId) {
          const item = window.ccfoliaAPI.items.getById(itemId);
          console.log(`%c[Clicked] ${itemId}`, "color: yellow; font-weight:bold;", JSON.parse(JSON.stringify(item)));
      }
  }


  installCcfoliaRpcBridge()
  console.log("%c[CCFOLIA-API] 인젝트 완료")

// --- 7. 테스트 코드 (요청하신 부분) ---
  // 페이지 로드 3초 후 실행됩니다.
  // setTimeout(async () => {
  //   console.log("[CCFOLIA-API] 10초 경과: 테스트 자동 실행 시도...")
    
  //   // ★ 여기에 테스트하고 싶은 캐릭터 이름을 적으세요
  //   const targetName = "크시카" 
    
  //   try {
  //       const char = window.ccfoliaAPI.getChar(targetName)
  //       if (char) {
  //           console.log(`[TEST] 타겟 발견: ${char.name}`)
            
  //           // 예시: HP를 1 깎습니다.
  //           // await window.ccfoliaAPI.setStatus(targetName, "HP", -1)
            
  //           // 예시: 투명화를 토글해봅니다. (필요없으면 주석처리)
  //           // await window.ccfoliaAPI.toggleProp(targetName, "invisible")
            
  //           console.log("[TEST] 테스트 동작 완료!")
  //       } else {
  //           console.warn(`[TEST] 이름에 '${targetName}'가 포함된 캐릭터를 찾지 못했습니다.`)
  //       }
  //   } catch (e) {
  //       console.error("[TEST] 테스트 중 에러 발생:", e)
  //   }
  // }, 10000)
}

// 실행
initCCfoliaAPI()

type CcReq =
  | { id: string; type: "ccfolia:call"; method: "updateCharacterHP"; args: [string, number] }
  | { id: string; type: "ccfolia:call"; method: "debug"; args: [] }

type CcRes =
  | { id: string; type: "ccfolia:result"; ok: true; value: any }
  | { id: string; type: "ccfolia:result"; ok: false; error: string }

function installCcfoliaRpcBridge() {
  window.addEventListener("message", async (ev) => {
    // 같은 window에서 온 메시지만 처리 (iframe 등 차단)
    if (ev.source !== window) return
    const data = ev.data as CcReq
    if (!data || data.type !== "ccfolia:call" || !data.id) return

    const reply = (res: CcRes) => window.postMessage(res, "*")

    try {
      const api = (window as any).ccfoliaAPI
      if (!api) throw new Error("ccfoliaAPI not ready")

      const fn = api[data.method]
      if (typeof fn !== "function") throw new Error(`Unknown method: ${data.method}`)

      const value = await fn(...(data.args as any))
      reply({ id: data.id, type: "ccfolia:result", ok: true, value })
    } catch (e: any) {
      reply({
        id: data.id,
        type: "ccfolia:result",
        ok: false,
        error: String(e?.message ?? e)
      })
    }
  })

  // console.log("ccfolia RPC bridge installed")
}
