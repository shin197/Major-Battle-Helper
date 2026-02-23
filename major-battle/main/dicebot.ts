import { applyMajorBattleDiceResult } from "../dice-roll"

// export const config: PlasmoCSConfig = {
//   matches: ["https://ccfolia.com/rooms/*"],
//   world: "MAIN", // 💡 MAIN 월드에서 실행하여 Redux Store에 직접 접근
//   run_at: "document_idle"
// }

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
    const myUid = currentState.app.state.uid
    const roomId = currentState.app.state.roomId
    const roomOwner = currentState.entities.rooms?.entities[roomId]?.owner
    const amIGM = myUid === roomOwner

    const messagesEntity = currentState.entities.roomMessages?.entities
    if (!messagesEntity) return

    const messageIds = currentState.entities.roomMessages.ids
    const recentIds = messageIds.slice(-5)

    recentIds.forEach((msgId: string) => {
      // 이미 처리한 메시지면 무시
      if (processedMessageIds.has(msgId)) return

      const msg = messagesEntity[msgId]
      if (!msg || !msg.extend || !msg.extend.roll) return

      // 크리티컬/펌블 등 특별한 상태일 경우 처리 안 함 (기존 로직 유지)
      if (msg.extend.roll.critical) {
        processedMessageIds.add(msgId)
        return
      }

      const msgOwner = msg.uid || msg.owner

      if (msgOwner === myUid) {
        // 내가 굴린 주사위일 때
        processedMessageIds.add(msgId)
        applyMajorBattleDiceResult(msgId, msg)
      } else if (amIGM) {
        // 내가 방장(GM)일 때, 다른 사람의 주사위를 1초 지연 처리
        setTimeout(() => {
          const checkState = store.getState()
          const currentMsg = checkState.entities.roomMessages?.entities[msgId]

          if (!currentMsg || currentMsg.extend?.roll?.critical) {
            processedMessageIds.add(msgId)
            return
          }

          processedMessageIds.add(msgId)
          // GM 대신 판정 적용이 필요하다면 아래 주석 해제
          // applyMajorBattleDiceResult(msgId, currentMsg)
        }, 1000)
      }
    })
  })
}

// 스크립트 실행 시점부터 엔진 대기 시작
