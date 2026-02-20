// contents/inject/api.ts
import { generateRandomId } from "~utils/utils"

import type { CcfoliaCharacter } from "../../utils/types"
import { getServices } from "./hijack"

let lastHoveredTokenId: string | null = null

export const buildAPI = () => {
  return {
    getCharacters: (
      filterType: "all" | "active" | "mine" | "status" = "all"
    ): CcfoliaCharacter[] => {
      const { store, selectors, rc } = getServices()
      const state = store.getState()

      // 1. Selector 모듈을 찾았다면 활용 (더 정확함)
      if (selectors) {
        let ids: string[] = []
        if (filterType === "active")
          ids = selectors.getRoomActiveCharacterIds(state)
        else if (filterType === "mine")
          ids = selectors.getMyRoomCharacterIds(state)
        else if (filterType === "status")
          ids = selectors.getRoomShowStatusCharacterIds(state)
        else ids = selectors.getRoomCharacterIds(state) // all
        return ids.map((id) => rc.entities[id]).filter(Boolean)
      }

      // 2. 못 찾았다면 수동 필터링 (Fallback)
      else {
        let chars = rc.ids.map((id: string) => rc.entities[id])
        if (filterType === "active") chars = chars.filter((c: any) => c.active)
        if (filterType === "mine") {
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
        const source = window.ccfoliaAPI
          .getCharacters("all")
          .find((c: any) => c.name.includes(sourceName))
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

      const target = window.ccfoliaAPI
        .getCharacters("all")
        .find((c: any) => c.name.includes(namePart))
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
      return rc.ids
        .map((id: string) => rc.entities[id])
        .find((c: CcfoliaCharacter) => c.name?.includes(namePart))
    },

    getCharacterById: (charId: string): CcfoliaCharacter | undefined => {
      const { rc } = getServices()
      return rc.entities[charId]
    },

    /**
     * 캐릭터의 특정 스테이터스(HP, MP, SAN 등) 값 변경
     * - namePart: 캐릭터 이름
     * - labelPart: 스테이터스 라벨 (예: "HP", "정신력")
     * - value: 설정할 값
     */
    setStatus: async (namePart: string, labelPart: string, value: number) => {
      const { fsTools, db, roomId, rc } = getServices()
      const { setDoc, doc, collection } = fsTools

      const target = window.ccfoliaAPI.getChar(namePart)
      if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

      const newStatus = target.status.map((s) => {
        if (s.label.includes(labelPart)) {
          // 최대값/최소값 보정 (선택사항)
          let val = value
          // if (val < 0) val = 0
          // if (val > s.max) val = s.max
          return { ...s, value: val }
        }
        return s
      })

      const targetRef = doc(
        collection(db, "rooms", roomId, "characters"),
        target._id
      )
      await setDoc(
        targetRef,
        { status: newStatus, updatedAt: Date.now() },
        { merge: true }
      )
      console.log(`[API] ${target.name}: ${labelPart} -> ${value}`)
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

      const newParams = target.params.map((p) => {
        if (p.label === labelPart) {
          return { ...p, value: newValue }
        }
        return p
      })

      const targetRef = doc(
        collection(db, "rooms", roomId, "characters"),
        target._id
      )
      await setDoc(
        targetRef,
        { params: newParams, updatedAt: Date.now() },
        { merge: true }
      )
      console.log(`[API] ${target.name}: ${labelPart} -> ${newValue}`)
    },

    /**
     * 캐릭터 속성 토글 (맵 표시, 투명화, 비밀 등)
     * - prop: 'active' | 'invisible' | 'secret'
     */
    toggleProp: async (
      namePart: string,
      prop: "active" | "invisible" | "secret"
    ) => {
      const { fsTools, db, roomId } = getServices()
      const { setDoc, doc, collection } = fsTools

      const target = window.ccfoliaAPI.getChar(namePart)
      if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

      const newValue = !target[prop]
      const targetRef = doc(
        collection(db, "rooms", roomId, "characters"),
        target._id
      )

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

      const targetRef = doc(
        collection(db, "rooms", roomId, "characters"),
        target._id
      )
      await setDoc(
        targetRef,
        { commands: newCommands, updatedAt: Date.now() },
        { merge: true }
      )
      console.log(`[API] ${target.name}: 명령어 수정 완료`)
    },

    patchCharacter: async (
      namePart: string,
      updates: {
        status?: Record<string, number>
        params?: Record<string, string>
      }
    ) => {
      const { fsTools, db, roomId } = getServices()
      const { setDoc, doc, collection } = fsTools

      // 1. 캐릭터 찾기
      const target = window.ccfoliaAPI.getChar(namePart)
      if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

      const updatePayload: any = { updatedAt: Date.now() }
      let hasChanges = false

      // 2. Status 업데이트 처리
      if (updates.status) {
        const newStatus = target.status.map((s: any) => {
          // updates.status 키 중에 s.label을 포함하는 것이 있는지 확인
          // (정확히 일치하는 것을 우선하고, 없으면 포함하는 것을 찾음 - 기존 로직 유지)

          // 정확한 일치 우선 검색
          if (updates.status![s.label] !== undefined) {
            hasChanges = true
            let val = updates.status![s.label]
            // val = Math.max(0, Math.min(val, s.max)) // 필요 시 주석 해제 (0~max 제한)
            return { ...s, value: val }
          }

          return s
        })
        updatePayload.status = newStatus
      }

      // 3. Params 업데이트 처리
      if (updates.params) {
        const newParams = target.params.map((p: any) => {
          if (updates.params![p.label] !== undefined) {
            hasChanges = true
            return { ...p, value: updates.params![p.label] }
          }
          return p
        })
        updatePayload.params = newParams
      }

      // 4. 변경 사항이 있을 때만 Firestore 저장
      if (hasChanges) {
        const targetRef = doc(
          collection(db, "rooms", roomId, "characters"),
          target._id
        )
        await setDoc(targetRef, updatePayload, { merge: true })
        console.log(`[API] Updated ${target.name}:`, updates)
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

    tokens: {
      getAll: () => {
        const { store } = getServices()
        const state = store.getState()
        const roomId = state.app.state.roomId
        const roomItems = state.entities.roomItems
        const roomDecks = state.entities.roomDecks
        const roomDices = state.entities.roomDices
        const roomCharacters = state.entities.roomCharacters
        const roomMarkers = Object.keys(
          state.entities.rooms.entities[roomId].markers || {}
        )

        const tokens = [
          ...roomItems.ids.map((id: string) => roomItems.entities[id]),
          ...roomDecks.ids.map((id: string) => roomDecks.entities[id]),
          ...roomDices.ids.map((id: string) => roomDices.entities[id]),
          ...roomCharacters.ids.map(
            (id: string) => roomCharacters.entities[id]
          ),
          ...roomMarkers
        ]
        return tokens
      },

      /**
       * 2. 특정 ID의 토큰(아이템, 덱, 다이스, 캐릭터, 마커) 정보 가져오기
       */
      getById: (itemId: string) => {
        const { store } = getServices()
        const state = store.getState()
        const roomId = state.app.state.roomId

        // getAll()에서 참조하는 5곳의 엔티티 그룹에서 순차적으로 ID를 조회합니다.
        return (
          state.entities.roomItems?.entities[itemId] ||
          state.entities.roomDecks?.entities[itemId] ||
          state.entities.roomDices?.entities[itemId] ||
          state.entities.roomCharacters?.entities[itemId] ||
          state.entities.rooms?.entities[roomId]?.markers?.[itemId] ||
          null
        )
      },

      /**
       * 3. 마우스 호버링 토큰 인스펙터 (토글)
       */
      toggleInspector: () => {
        if ((window as any).__CCFOLIA_TOKEN_INSPECTOR_ACTIVE) {
          // 끄기
          document.removeEventListener("mousemove", tokenHoverHandler)
          document.removeEventListener("click", tokenClickHandler)
          ;(window as any).__CCFOLIA_TOKEN_INSPECTOR_ACTIVE = false
          console.log("%c[API] 🕵️‍♂️ 토큰 인스펙터 OFF", "color: gray")
        } else {
          // 켜기
          document.addEventListener("mousemove", tokenHoverHandler)
          document.addEventListener("click", tokenClickHandler)
          ;(window as any).__CCFOLIA_TOKEN_INSPECTOR_ACTIVE = true
          console.log(
            "%c[API] 🕵️‍♂️ 토큰 인스펙터 ON - 캐릭터/다이스/덱/아이템 위에 마우스를 올리세요.",
            "color: #006400"
          )
        }
      }
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
          const req = window.webpackRequire
          if (!req) throw new Error("WebpackRequire 없음")

          const mod = req(moduleId)
          console.group(`📦 Module [${moduleId}] Inspector`)
          console.log("Exported Value:", mod)

          // 함수 목록만 따로 보여주기 (Signature 확인용)
          if (typeof mod === "object") {
            console.groupCollapsed("Functions List")
            Object.entries(mod).forEach(([key, val]) => {
              if (typeof val === "function") {
                console.log(`${key}:`, val.toString().slice(0, 50) + "...")
              }
            })
            console.groupEnd()
          }
          console.groupEnd()
          return mod
        } catch (e) {
          console.error(`모듈 ${moduleId} 로드 실패:`, e)
        }
      },

      /**
       * 2. 키워드로 모든 모듈을 검색합니다. (보물 찾기!)
       * 사용법: ccfoliaAPI.devtools.search("PlaySound")
       * 주의: 너무 짧은 키워드는 결과가 많을 수 있습니다.
       */
      search: (keyword: string) => {
        const req = window.webpackRequire
        const modules = req.m // 모듈 팩토리 배열
        const results: Record<string, any> = {}

        console.log(`🔎 "${keyword}" 검색 시작...`)

        for (const id in modules) {
          try {
            // 모듈 소스코드(문자열)에서 검색 (로딩 전 탐색)
            const source = modules[id].toString()
            if (source.includes(keyword)) {
              console.log(`FOUND in Source [${id}]`)
              // 안전하게 로드 시도
              try {
                results[id] = req(id)
              } catch {
                results[id] = "(Load Error)"
              }
            }
          } catch (e) {}
        }

        console.log("검색 결과:", results)
        return results
      },

      /**
       * 3. 현재 로드된 모든 모듈의 ID 목록을 봅니다.
       */
      listAll: () => {
        console.log("Available Modules:", Object.keys(window.webpackRequire.m))
      },

      /**
       * 4. [NEW] React Local State 스니퍼
       * 사용법: 마우스를 요소에 올린 뒤 콘솔에서 ccfoliaAPI.devtools.inspectLocalState() 실행
       */
      inspectLocalState: () => {
        // 현재 마우스가 올라간 DOM 요소를 찾습니다 (hover.js 같은 로직 응용)
        const hoveredElement = document.querySelector(":hover")
        if (!hoveredElement) {
          console.log("마우스를 화면의 요소 위에 올려두고 다시 실행해주세요.")
          return
        }

        // DOM에서 가장 깊숙한(마지막으로 마우스가 닿은) 요소 찾기
        const elements = document.querySelectorAll(":hover")
        const targetDom = elements[elements.length - 1] as HTMLElement

        const findFiber = (dom: HTMLElement) => {
          const key = Object.keys(dom).find((k) =>
            k.startsWith("__reactFiber$")
          )
          return key ? (dom as any)[key] : null
        }

        console.group(`🕵️‍♂️ React Local State Inspector`)
        let node = findFiber(targetDom)
        let depth = 0

        // 부모 컴포넌트로 5단계만 거슬러 올라가며 탐색합니다.
        while (node && depth < 12) {
          const compName =
            node.type?.name ||
            (typeof node.type === "string" ? node.type : "Unknown")
          console.groupCollapsed(`[Depth ${depth}] Component: <${compName}>`)

          // 1. Props 출력 (부모가 준 데이터)
          console.log("🎁 Props:", node.memoizedProps)

          // 2. Local State 출력 (스스로 관리하는 데이터)
          if (node.memoizedState) {
            // Hooks 기반 함수형 컴포넌트인지 판별
            if (node.memoizedState.memoizedState !== undefined) {
              console.log("🧠 Local State (Hooks LinkedList):")
              let hook = node.memoizedState
              let index = 0
              while (hook) {
                console.log(`  └─ Hook[${index}]:`, hook.memoizedState)
                hook = hook.next
                index++
              }
            } else {
              // 클래스형 컴포넌트인 경우 (보통 객체 형태라 보기 편함)
              console.log("🧠 Local State (Class Object):", node.memoizedState)
            }
          } else {
            console.log("🧠 Local State: None")
          }

          console.groupEnd()
          node = node.return // 부모로 이동
          depth++
        }
        console.groupEnd()
      }
    }
  }
}
const tokenHoverHandler = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const itemId = findItemIdFromDom(target)

  if (itemId && itemId !== lastHoveredTokenId) {
    lastHoveredTokenId = itemId
    const token = window.ccfoliaAPI.tokens.getById(itemId)

    if (token) {
      console.log(
        `%c[Found Token] ${token.name || "No Name"} (${itemId})`,
        "color: #006400",
        token
      )

      // 시각적 피드백
      target.style.outline = "2px solid #00ff0d"
      setTimeout(() => (target.style.outline = ""), 500)
    }
  }
}

const tokenClickHandler = (e: MouseEvent) => {
  // 클릭 시 해당 토큰 정보 고정 출력 (Deep copy)
  const target = e.target as HTMLElement
  const itemId = findItemIdFromDom(target)
  if (itemId) {
    const token = window.ccfoliaAPI.tokens.getById(itemId)
    if (token) {
      console.log(
        `%c[Clicked Token] ${itemId}`,
        "color: #005c8e; font-weight:bold;",
        JSON.parse(JSON.stringify(token))
      )
    }
  }
}

const findReactProps = (dom: HTMLElement): any => {
  const key = Object.keys(dom).find((k) => k.startsWith("__reactFiber$"))
  // @ts-ignore
  return key ? dom[key] : null
}

const findItemIdFromDom = (target: HTMLElement | null): string | null => {
  let curr = target
  while (curr && curr !== document.body) {
    const fiber = findReactProps(curr)
    if (fiber) {
      let node = fiber
      while (node) {
        const props = node.memoizedProps
        if (props) {
          // 1. ID 값만 넘겨받는 경우
          const idFromProp =
            props.itemId ||
            props.characterId ||
            props.diceId ||
            props.deckId ||
            props.markerId

          if (idFromProp) return idFromProp

          // 2. draggableId 방식 추가!
          if (props.draggableId && typeof props.draggableId === "string") {
            // 여기서 id를 반환합니다.
            return props.draggableId
          }
        }

        node = node.return // 부모 컴포넌트로 이동
      }
    }
    curr = curr.parentElement
  }
  return null
}
