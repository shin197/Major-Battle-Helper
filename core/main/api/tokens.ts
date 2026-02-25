import { findItemIdFromDom } from "~utils/main/token"
import { generateRandomId } from "~utils/utils"

import { getServices } from "../hijack"

let lastHoveredTokenId: string | null = null

export const tokens = {
  getAll: () => {
    const { store, roomId } = getServices()
    const state = store.getState()

    const roomItems = state.entities.roomItems
    const roomDecks = state.entities.roomDecks
    const roomDices = state.entities.roomDices
    const roomCharacters = state.entities.roomCharacters

    // 💡 1. 마커 원본 객체를 가져옵니다.
    const rawMarkers = state.entities.rooms.entities[roomId].markers || {}

    // 💡 2. Object.entries를 이용해 키(id)와 값(marker)을 분리한 뒤 합쳐줍니다.
    const roomMarkers = Object.entries(rawMarkers).map(
      ([id, marker]: [string, any]) => ({
        ...marker,
        id: id, // 누락된 id를 객체 내부에 강제 주입
        _type: "roomMarker"
      })
    )

    const tokens = [
      ...(roomItems
        ? roomItems.ids.map((id: string) => ({
            ...roomItems.entities[id],
            _type: "roomItem"
          }))
        : []),
      ...(roomDecks
        ? roomDecks.ids.map((id: string) => ({
            ...roomDecks.entities[id],
            _type: "roomDeck"
          }))
        : []),
      ...(roomDices
        ? roomDices.ids.map((id: string) => ({
            ...roomDices.entities[id],
            _type: "roomDice"
          }))
        : []),
      ...(roomCharacters
        ? roomCharacters.ids.map((id: string) => ({
            ...roomCharacters.entities[id],
            _type: "roomCharacter"
          }))
        : []),

      // 마커는 위에서 이미 매핑했으므로 바로 전개(...) 합니다.
      ...roomMarkers
    ]

    return tokens
  },

  getById: (itemId: string) => {
    const { store } = getServices()
    const state = store.getState()
    const roomId = state.app.state.roomId

    const roomItems = state.entities.roomItems?.entities
    if (roomItems?.[itemId]) return { ...roomItems[itemId], _type: "roomItem" }

    const roomDecks = state.entities.roomDecks?.entities
    if (roomDecks?.[itemId]) return { ...roomDecks[itemId], _type: "roomDeck" }

    const roomDices = state.entities.roomDices?.entities
    if (roomDices?.[itemId]) return { ...roomDices[itemId], _type: "roomDice" }

    const roomCharacters = state.entities.roomCharacters?.entities
    if (roomCharacters?.[itemId])
      return { ...roomCharacters[itemId], _type: "roomCharacter" }

    // 💡 3. 개별 조회 시에도 id를 찾아서 넣어줍니다.
    const roomMarkers = state.entities.rooms?.entities[roomId]?.markers
    if (roomMarkers?.[itemId]) {
      return {
        ...roomMarkers[itemId],
        id: itemId,
        _type: "roomMarker"
      }
    }

    return null
  },

  patch: async (tokenId: string, updates: Record<string, any>) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    // 토큰 종류 파악
    const target = tokens.getById(tokenId)
    if (!target) throw new Error(`토큰 '${tokenId}'를 찾을 수 없습니다.`)

    const type = target._type
    const payload = { ...updates, updatedAt: Date.now() }

    // 타입에 따라 Firestore 저장 경로 분기
    if (type === "roomMarker") {
      // 마커: 방 문서(rooms/roomId) 내부의 markers 객체에 접근
      const roomRef = doc(collection(db, "rooms"), roomId)

      // merge: true 를 사용하면 markers 객체 내의 특정 ID만 깊은 병합(Deep Merge)됩니다.
      await setDoc(
        roomRef,
        { markers: { [tokenId]: payload } },
        { merge: true }
      )
      // console.log(`[API] 마커 패널(${tokenId}) 패치 완료:`, updates)
    } else {
      // 그 외: 각각의 서브 컬렉션(items, characters 등)에 독립된 문서로 존재
      let colName = ""
      if (type === "roomItem") colName = "items"
      else if (type === "roomCharacter") colName = "characters"
      else if (type === "roomDice") colName = "dices"
      else if (type === "roomDeck") colName = "decks"
      else throw new Error(`지원하지 않는 토큰 타입: ${type}`)

      const tokenRef = doc(collection(db, "rooms", roomId, colName), tokenId)
      await setDoc(tokenRef, payload, { merge: true })
      // console.log(`[API] ${type}(${tokenId}) 패치 완료:`, updates)
    }
  },

  patchBulk: async (
    updates: Array<{ id: string; _type: string; data: Record<string, any> }>
  ) => {
    const { fsTools, db, roomId } = getServices()
    const { writeBatch, doc, collection } = fsTools

    if (!writeBatch)
      throw new Error(
        "writeBatch 함수를 찾을 수 없습니다. (hijack.ts 확인 필요)"
      )

    // 1. 빈 상자(Batch)를 만듭니다.
    const batch = writeBatch(db)
    const roomRef = doc(collection(db, "rooms"), roomId)

    // 2. 상자에 업데이트할 토큰들을 차곡차곡 담습니다.
    updates.forEach(({ id, _type, data }) => {
      const payload = { ...data, updatedAt: Date.now() }

      if (_type === "roomMarker") {
        // 마커는 방 문서의 객체 안에 병합
        batch.set(roomRef, { markers: { [id]: payload } }, { merge: true })
      } else {
        // 일반 토큰은 각자의 컬렉션에 병합
        let colName = ""
        if (_type === "roomItem") colName = "items"
        else if (_type === "roomCharacter") colName = "characters"
        else if (_type === "roomDice") colName = "dices"
        else if (_type === "roomDeck") colName = "decks"

        if (colName) {
          const tokenRef = doc(collection(db, "rooms", roomId, colName), id)
          batch.set(tokenRef, payload, { merge: true })
        }
      }
    })

    // 3. 꽉 찬 상자를 서버로 단 한 번만 전송합니다!
    await batch.commit()
    // console.log(`[API] 🚀 ${updates.length}개 토큰 일괄(Batch) 업데이트 완료!`)
  },

  /**
   * 토큰 생성 (스크린 패널, 마커 등)
   */
  create: async (
    type: "roomItem" | "roomMarker",
    payload: Record<string, any>
  ) => {
    const { fsTools, db, roomId, store, roomItemActions, roomActions } =
      getServices()
    const { setDoc, doc, collection } = fsTools
    const state = store.getState()
    const owner = state.app.state.uid

    const newId = generateRandomId()

    // 💡 1. 공통 템플릿 (절대 누락되면 안 되는 값들)
    let baseTemplate: any = {
      name: "",
      locked: false,
      width: 2,
      height: 2,
      z: 0,
      order: 0, // 👈 렌더링에 필수적인 정렬 값
      owner,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (type === "roomItem") {
      // 1. 탈취한 모듈 안에서 정확한 함수(addRoomItem) 찾기
      let addRoomItemFn: Function | null = null

      if (roomItemActions) {
        if (typeof roomItemActions.addRoomItem === "function") {
          addRoomItemFn = roomItemActions.addRoomItem
        } else {
          // 이름이 맹글링(Mangling)된 경우를 대비해 값 탐색
          addRoomItemFn = Object.values(roomItemActions).find(
            (fn: any) =>
              typeof fn === "function" &&
              (fn.toString().includes('"update-item"') ||
                fn.toString().includes("getMaxZIndex"))
          ) as Function
        }
      }

      if (addRoomItemFn) {
        // 2. 코코포리아 네이티브 방식(Thunk)으로 데이터 쏘기
        // Redux Thunk 구조이므로 store.dispatch(addRoomItemFn(payload)) 형태로 실행합니다.
        await store.dispatch(addRoomItemFn(payload))
        console.log("[API] 원본 함수를 이용해 스크린 패널(roomItem) 생성 완료!")
        return
      }
    } else if (type === "roomMarker") {
      baseTemplate = { ...baseTemplate, message: "", color: "#000000" }
    }

    // 💡 3. 기본값 위에 사용자가 입력한 payload를 덮어씌움
    const newPayload = {
      ...baseTemplate,
      ...payload
    }

    // --- 이후 Firestore 저장 로직은 기존과 동일 ---
    if (type === "roomMarker") {
      let addMarkerFn: Function | null = null

      // 1. 탈취한 모듈에서 함수 찾기 시도
      if (roomActions) {
        if (typeof roomActions.addRoomMarker === "function") {
          addMarkerFn = roomActions.addRoomMarker
        } else {
          addMarkerFn = Object.values(roomActions).find(
            (fn: any) =>
              typeof fn === "function" &&
              fn.toString().includes('"update-marker"')
          ) as Function
        }
      }

      // 2-A. 탈취 성공: 원본 Redux Thunk로 Dispatch
      if (addMarkerFn) {
        await store.dispatch(addMarkerFn(payload))
        console.log("[API] 원본 함수를 이용해 마커 패널 생성 완료!")
        return // (Thunk는 ID를 바로 반환하지 않음)
      }
      // 2-B. 탈취 실패: 수동(Fallback)으로 직접 계산해서 Firestore에 밀어넣기
      else {
        console.log(
          "[API] 원본 마커 생성 함수 탐색 실패. Fallback(수동 생성)을 시도합니다."
        )
        const { setDoc, doc, collection } = fsTools

        // 기존 마커들을 뒤져서 가장 높은 Z-index 계산 (getMaxZIndexInMarkers 흉내)
        const rawMarkers = state.entities.rooms.entities[roomId].markers || {}
        const markersArray = Object.values(rawMarkers) as any[]
        const maxZ = markersArray.reduce((max, m) => Math.max(max, m.z || 0), 0)

        // 💡 원본 코드에서 발견한 방식 그대로 ID 생성!
        const newMarkerId = Date.now().toString(16)

        const baseTemplate = {
          message: "",
          color: "#000000",
          locked: false,
          z: maxZ + 1,
          owner,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        const newPayload = { ...baseTemplate, ...payload }

        const roomRef = doc(collection(db, "rooms"), roomId)
        await setDoc(
          roomRef,
          { markers: { [newMarkerId]: newPayload } },
          { merge: true }
        )

        console.log(`[API] 마커 패널(${newMarkerId}) 수동 생성 완료`)
        return newMarkerId
      }
    } else {
      let colName = ""
      if (type === "roomItem") colName = "items"
      else if (type === "roomDice") colName = "dices"
      else if (type === "roomDeck") colName = "decks"
      else throw new Error(`지원하지 않는 토큰 생성 타입: ${type}`)

      const tokenRef = doc(collection(db, "rooms", roomId, colName), newId)
      await setDoc(tokenRef, newPayload)
      console.log(`[API] ${type}(${newId}) 생성 완료`)
    }

    return newId
  },

  /**
   * 토큰 삭제
   */
  delete: async (tokenId: string) => {
    const { fsTools, db, roomId } = getServices()
    const { doc, collection, deleteDoc, setDoc } = fsTools

    const target = tokens.getById(tokenId)
    if (!target) throw new Error(`토큰 '${tokenId}'를 찾을 수 없습니다.`)

    const type = target._type

    if (type === "roomMarker") {
      // 마커 삭제 (Map 객체의 특정 키 제거)
      // 주의: Firestore SDK의 deleteField() 함수가 없으므로 null을 할당하여 비활성화/삭제 유도
      const roomRef = doc(collection(db, "rooms"), roomId)
      await setDoc(roomRef, { markers: { [tokenId]: null } }, { merge: true })
      console.log(`[API] 마커 패널(${tokenId}) 삭제 완료 (null 처리)`)
    } else {
      // 스크린 패널(roomItem) 등 독립된 컬렉션 문서 삭제
      if (!deleteDoc)
        throw new Error("deleteDoc 함수를 찾을 수 없습니다. (hijack.ts 확인)")

      let colName = ""
      if (type === "roomItem") colName = "items"
      else if (type === "roomCharacter") colName = "characters"
      else if (type === "roomDice") colName = "dices"
      else if (type === "roomDeck") colName = "decks"

      const tokenRef = doc(collection(db, "rooms", roomId, colName), tokenId)
      await deleteDoc(tokenRef)
      console.log(`[API] ${type}(${tokenId}) 삭제 완료`)
    }
  },

  /**
   * 마우스 호버링 토큰 인스펙터 (토글)
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
}
const tokenHoverHandler = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const itemId = findItemIdFromDom(target)

  if (itemId && itemId !== lastHoveredTokenId) {
    lastHoveredTokenId = itemId
    const token = tokens.getById(itemId)

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
    const token = tokens.getById(itemId)
    if (token) {
      console.log(
        `%c[Clicked Token] ${itemId}`,
        "color: #005c8e; font-weight:bold;",
        JSON.parse(JSON.stringify(token))
      )
    }
  }
}
