import { getServices } from "../hijack"

export const messages = {
  /**
   * 모든 메시지 목록을 가져옵니다. (tokens.ts의 getAll과 유사)
   */
  getAll: () => {
    const { store } = getServices()
    const state = store.getState()

    const roomMessages = state.entities.roomMessages
    if (!roomMessages) return []

    // id 배열을 순회하며 메시지 객체 배열 반환
    return roomMessages.ids.map((id: string) => roomMessages.entities[id])
  },

  /**
   * 특정 메시지의 주사위 굴림 결과를 Firestore에 직접 업데이트하여 모든 유저에게 동기화합니다.
   * @param messageId 조작할 메시지의 ID
   * @param newResultText 변경할 주사위 결과 텍스트 (예: "1D100<=50 ＞ 99 ＞ 펌블")
   * @param options 성공/실패/크리티컬/펌블 여부 덮어쓰기
   */
  modifyRollResult: async (
    messageId: string,
    newResultText: string,
    options?: {
      success?: boolean
      failure?: boolean
      critical?: boolean
      fumble?: boolean
    }
  ) => {
    // 💡 1. hijack.ts에서 탈취한 Firestore 도구들 가져오기
    const { fsTools, db, roomId, store } = getServices()
    const { setDoc, doc, collection } = fsTools
    const state = store.getState()

    // 💡 2. 기존 Redux Store에서 메시지 원본 데이터 확인
    const messagesEntity = state.entities.roomMessages?.entities
    if (!messagesEntity || !messagesEntity[messageId]) {
      console.warn(
        `[CCFOLIA-API] Message ${messageId} not found in local store.`
      )
      return false
    }

    const targetMessage = messagesEntity[messageId]

    // 주사위 굴림(extend.roll) 데이터가 있는지 확인
    if (!targetMessage.extend || !targetMessage.extend.roll) {
      console.warn(
        `[CCFOLIA-API] Message ${messageId} does not have roll data.`
      )
      return false
    }

    // 💡 3. 새로 업데이트할 주사위 데이터 객체 구성
    const updatedRoll = {
      ...targetMessage.extend.roll, // 기존 roll 데이터 유지 (주사위 눈금 등)
      result: newResultText // 결과 텍스트 덮어쓰기
    }

    if (options) {
      if (options.success !== undefined) updatedRoll.success = options.success
      if (options.failure !== undefined) updatedRoll.failure = options.failure
      if (options.critical !== undefined)
        updatedRoll.critical = options.critical
      if (options.fumble !== undefined) updatedRoll.fumble = options.fumble
    }

    // 💡 4. Firestore 업데이트 페이로드 작성
    // 주의: setDoc + merge:true를 사용하더라도 중첩 객체인 extend 내부가 전부 날아갈 수 있으므로,
    // 기존 extend 객체를 풀어서(...) 다시 감싸줍니다.
    const payload = {
      extend: {
        ...targetMessage.extend,
        roll: updatedRoll
      },
      updatedAt: Date.now() // 코코포리아 클라이언트들의 리렌더링 및 동기화를 트리거하기 위해 갱신
    }

    try {
      // 💡 5. Firestore 문서 경로 설정 (rooms -> roomId -> messages -> messageId)
      const messageRef = doc(
        collection(db, "rooms", roomId, "messages"),
        messageId
      )

      // 💡 6. Firebase에 데이터 Patch 쏘기
      await setDoc(messageRef, payload, { merge: true })

      // console.log(
      //   `%c[API] 주사위 판정 글로벌 패치 완료: ${messageId}`,
      //   "color: #ff5c8e; font-weight:bold;",
      //   updatedRoll
      // )
      return true
    } catch (error) {
      // console.error(`[API] 주사위 결과 업데이트 실패:`, error)
      return false
    }
  }
}
