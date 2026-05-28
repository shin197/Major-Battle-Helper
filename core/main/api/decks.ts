import { getServices } from "../hijack"
import { generateRandomId } from "~utils/utils"
import { tokens } from "./tokens"

export const decks = {
  create: async (deckPayload: Record<string, any>, items: Array<any>) => {
    const { fsTools, db, roomId, store } = getServices()
    const { addDoc, collection } = fsTools

    // 💡 1. 덱 안에 넣을 아이템 변환
    const deckItems: Record<string, any> = {}
    for (const item of items) {
      const cardId = generateRandomId()
      deckItems[cardId] = {
        imageUrl: item.imageUrl || item.image || "",
        memo: item.memo || item.name || ""
      }
    }

    let maxZIndex = 5

    const payload = {
      ...deckPayload,
      x: typeof deckPayload.x === "number" && !isNaN(deckPayload.x) ? deckPayload.x : -1,
      y: typeof deckPayload.y === "number" && !isNaN(deckPayload.y) ? deckPayload.y : -1,
      z: 99,
      zIndex: typeof deckPayload.zIndex === "number" ? deckPayload.zIndex : maxZIndex,
      width: deckPayload.width || 4,
      height: deckPayload.height || 4,
      locked: !!deckPayload.locked,
      freezed: !!deckPayload.freezed,
      coverImageUrl: deckPayload.coverImageUrl || null,
      items: deckItems,
      updatedAt: Date.now(),
      createdAt: Date.now()
    }

    const docRef = await addDoc(collection(db, "rooms", roomId, "decks"), payload)
    console.log(`[API] 덱(${docRef.id}) 커스텀 생성 완료 (카드 수: ${items.length})`)

    return docRef.id
  },

  extractCard: async (deckId: string, itemId: string, isClosed: boolean) => {
    const { fsTools, db, roomId, store, deckActions, selectors } = getServices()
    const { addDoc, collection, updateDoc, doc, setDoc } = fsTools
    const state = store.getState()
    const uid = state.app?.user?.uid || "NONAME"
    const name = state.app?.state?.roomChatName || "NONAME"
    const deck = state.entities?.roomDecks?.entities?.[deckId]

    if (!deck || !deck.items || !deck.items[itemId]) {
      throw new Error(`[API] 덱 또는 카드를 찾을 수 없습니다: ${deckId}/${itemId}`)
    }

    const cardData = deck.items[itemId]

    // 1. 새 RoomItem 생성
    const newItemPayload = {
      ...cardData,
      coverImageUrl: deck.coverImageUrl,
      imageUrl: cardData.imageUrl,
      memo: cardData.memo,
      x: deck.x + 1,
      y: deck.y + 1,
      z: deck.zIndex,
      width: deck.width,
      height: deck.height,
      deckId: deckId,
      closed: isClosed,
      freezed: deck.freezed,
      owner: isClosed ? uid : null,
      ownerName: isClosed ? name : null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // const newItemRef = await addDoc(collection(db, "rooms", roomId, "items"), newItemPayload)
    // console.log(`[API] 카드 추출 성공 -> 새 아이템 ID: ${newItemRef.id}`)
    await tokens.create("roomItem", newItemPayload)

    // 2. 덱에서 해당 카드 삭제 (객체 복제 후 삭제 처리)
    const newItems = { ...deck.items }
    delete newItems[itemId]

    const deckRef = doc(db, "rooms", roomId, "decks", deckId)
    if (updateDoc) {
      try {
        await updateDoc(deckRef, { items: newItems })
      } catch (e) {
        await setDoc(deckRef, { ...deck, items: newItems })
      }
    } else {
      await setDoc(deckRef, { ...deck, items: newItems })
    }

    // return newItemRef.id
    return null
  },

  getById: (deckId: string) => {
    const { store } = getServices()
    const decks = store.getState().entities.roomDecks
    return decks.entities[deckId] || null
  },

  update: async (deckId: string, updates: Record<string, any>) => {
    const { fsTools, db, roomId, store } = getServices()
    const { updateDoc, setDoc, doc } = fsTools
    const ref = doc(db, "rooms", roomId, "decks", deckId)

    if (updateDoc) {
      try {
        await updateDoc(ref, updates)
        console.log(`[API] 덱(${deckId}) 업데이트 완료 (updateDoc)`)
        return
      } catch (e) {
        console.warn("[API] updateDoc 실패, setDoc 풀 카피로 폴백합니다.", e)
      }
    }

    // 폴백: 전체 객체를 복사해서 덮어쓰기 (setDoc without merge)
    const state = store.getState()
    const existingDeck = state.entities?.roomDecks?.entities?.[deckId]
    if (!existingDeck) {
      console.error("[API] 덱 데이터를 찾을 수 없어 업데이트 불가")
      return
    }

    const fullPayload = { ...existingDeck, ...updates }
    await setDoc(ref, fullPayload)
    console.log(`[API] 덱(${deckId}) 업데이트 완료 (setDoc Full Copy)`)
  }
}
