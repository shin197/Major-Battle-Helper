import { applyMajorBattleDiceResult } from "../dice-roll"

const processedMessageIds = new Set<string>()

// 💡 1. Core 엔진이 Redux를 훔쳐올 때까지 대기
export function waitForCoreEngine() {
  if (window.__MY_REDUX) {
    console.log(
      "%c[Major-Battle] ⚔️ 룰셋 플러그인 활성화 완료",
      "color: #ff9800"
    )
    startMessageListener(window.__MY_REDUX)
  } else {
    // 아직 없으면 0.1초 뒤에 다시 확인
    setTimeout(waitForCoreEngine, 100)
  }
}

// 💡 2. Store 구독 및 메세지(주사위 결과) 파싱 로직
function startMessageListener(store: any) {
  store.subscribe(() => {
    const currentState = store.getState()
    const myUid = currentState.app.user.uid
    const roomId = currentState.app.state.roomId
    const roomOwner = currentState.entities.rooms?.entities[roomId]?.owner
    const amIGM = myUid === roomOwner

    const messagesEntity = currentState.entities.roomMessages?.entities
    if (!messagesEntity) return

    if (!amIGM) return

    const messageIds = currentState.entities.roomMessages.ids
    const recentIds = messageIds.slice(-5)

    recentIds.forEach((msgId: string) => {
      // 이미 처리한 메시지면 무시
      if (processedMessageIds.has(msgId)) return

      const msg = messagesEntity[msgId]
      if (!msg || !msg.extend || !msg.extend.roll) return

      // 크리티컬 메시지는 무시 (이미 Major Battle 룰셋에서 처리됨)
      if (msg.extend.roll.critical) {
        processedMessageIds.add(msgId)
        return
      }

      processedMessageIds.add(msgId)
      applyMajorBattleDiceResult(msgId, msg)
    })
  })
}

// 스크립트 실행 시점부터 엔진 대기 시작
