import { getServices } from "../hijack"
import type { CcfoliaDiceToken } from "../../../utils/types"

type UpdateDiceItem = Partial<CcfoliaDiceToken>

export const diceTokens = {
  getAll: (): CcfoliaDiceToken[] => {
    const { store } = getServices()
    const state = store.getState()
    // Try roomDiceTokens or roomDices based on typical ccfolia state shapes
    const roomDice = state.entities?.roomDices?.entities
    if (!roomDice) return []
    return Object.values(roomDice)
  },
  get: (diceId: string): CcfoliaDiceToken => {
    const { store, diceActions } = getServices()
    if (diceActions && diceActions.getRoomDice) {
      return diceActions.getRoomDice(diceId)
    }
    const state = store.getState()
    const roomDice = state.entities?.roomDices?.entities[diceId]
    return roomDice
  },
  create: async (data: UpdateDiceItem) => {

    const { fsTools, db, roomId, store } = getServices()
    const { addDoc, setDoc, doc, collection } = fsTools
    const state = store.getState()

    const diceRef = collection(db, "rooms", roomId, "dices")

    // 1. 템플릿 준비
    let template: any = {
      x: typeof data.x === "number" && !isNaN(data.x) ? data.x : -1,
      y: typeof data.y === "number" && !isNaN(data.y) ? data.y : -1,
      width: 2,
      height: 2,
      faces: 6,
      value: 1,
      closed: false,
      name: state.app.user.displayName,
      owner: state.app.user.uid, // 내 캐릭터로 생성
      changeCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    template = {
      ...template,
      ...data
    }

    // 2. addDoc을 사용하여 새 문서 생성 (ID 자동 부여)
    const docRef = await addDoc(diceRef, template)
    console.log(`[API] 주사위 토큰 생성 완료: ${template.name}, ID: ${docRef.id}`)

    return docRef.id
  },
  delete: async (diceId: string) => {
    const { store, diceActions } = getServices()
    if (!diceActions || !diceActions.deleteRoomDice) throw new Error("diceActions 모듈을 찾을 수 없습니다.")
    return store.dispatch(diceActions.deleteRoomDice(diceId))
  },
  update: async (diceId: string, item: UpdateDiceItem) => {
    const { store, diceActions } = getServices()
    if (!diceActions || !diceActions.updateRoomDice) throw new Error("diceActions 모듈을 찾을 수 없습니다.")
    return store.dispatch(diceActions.updateRoomDice(diceId, item))
  },
  updateAnnounce: async (diceId: string, item: UpdateDiceItem) => {
    const { store, diceActions } = getServices()
    if (!diceActions || !diceActions.updateCurrentRoomDice) throw new Error("diceActions 모듈을 찾을 수 없습니다.")
    return store.dispatch(diceActions.updateCurrentRoomDice(item, diceId))
  },
  roll: async (diceId: string, options: { faces: number[], closed: boolean }) => {
    const { store, diceActions } = getServices()
    if (!diceActions || !diceActions.updateRollRoomDice) throw new Error("diceActions 모듈을 찾을 수 없습니다.")
    return store.dispatch(diceActions.updateRollRoomDice(diceId, options))
  },
  rollSilent: async (diceId: string) => {
    const { store, diceActions } = getServices()
    if (!diceActions || !diceActions.updateRollRoomDice) throw new Error("diceActions 모듈을 찾을 수 없습니다.")
    const currentDice = diceActions.getRoomDice(diceId)
    const item = {
      ...currentDice,
      value: Math.floor(Math.random() * currentDice.faces) + 1,
    }
    return store.dispatch(diceActions.updateRoomDice(diceId, item))
  }
}