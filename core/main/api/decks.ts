import { getServices } from "../hijack"
import { generateRandomId } from "~utils/utils"

export const decks = {
  create: async (deckPayload: Record<string, any>, items: Array<any>) => {
    const { fsTools, db, roomId, store, selectors } = getServices()
    const { addDoc, collection } = fsTools
    const state = store.getState()

    // 💡 1. 덱 안에 넣을 아이템 변환
    const deckItems: Record<string, any> = {}
    for (const item of items) {
      const cardId = generateRandomId()
      deckItems[cardId] = {
        // 코코포리아 스크린 패널(roomItem)은 보통 image 속성 등을 가지므로 적절히 맵핑합니다.
        imageUrl: item.imageUrl || item.image || "",
        memo: item.memo || item.name || ""
      }
    }

    // 💡 2. Z-Index 계산 (가능한 경우)
    let maxZIndex = 5
    // selectors.getMaxZIndex 등이 맹글링되어 있을 수 있으므로 임시 처리
    // 완벽한 구현을 위해서는 나중에 Z-index 스캐너를 연결할 수 있습니다.

    // 💡 3. 페이로드 조립 (사용자 제공 샘플 기반)
    const payload = {
      ...deckPayload,
      x: typeof deckPayload.x === "number" && !isNaN(deckPayload.x) ? deckPayload.x : 0,
      y: typeof deckPayload.y === "number" && !isNaN(deckPayload.y) ? deckPayload.y : 0,
      z: typeof deckPayload.z === "number" ? deckPayload.z : 99,
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
  }
}
