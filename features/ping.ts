import { ccf } from "~core/isolated/ccfolia-api"
import { getServices } from "~core/main/hijack"
import { getGridCoordinateFromMouse } from "~utils/mouse-tracker"

// 핑 쿨다운 상태를 관리하는 플래그
let isPingActive = false

const PING_ICON_URL =
  "https://storage.ccfolia-cdn.net/users/WVlt9khBkddLydSXu6Gn0unTgYj2/files/177e0f037811eedc07c3cf8527063d11b7adf3edefc669b3b894f8a2a9857d0e?t=1762242145918"

export function initPingSystem() {
  document.addEventListener(
    "pointerdown",
    async (e: PointerEvent) => {
      // Ctrl + 좌클릭
      if (e.ctrlKey && e.button === 0) {
        // 1. 쿨다운 체크: 이미 핑이 찍혀있다면 무시합니다.
        if (isPingActive) {
          console.log("[Ping] 📍 핑은 한 번에 하나씩만 찍을 수 있습니다.")
          return
        }

        // 쿨다운 시작!
        isPingActive = true
        const { x, y } = getGridCoordinateFromMouse(e.clientX, e.clientY)

        // 나중에 찾아내기 위한 특수 명찰
        const PING_IDENTIFIER = "MBH_PING_MARKER" + Date.now() // 고유한 ID 생성 (시간 기반)

        try {
          await ccf.tokens.create("roomItem", {
            memo: PING_IDENTIFIER, // 💡 ID를 모르니 특이한 이름을 붙여둡니다.
            x: x - 1,
            y: y - 1,
            width: 2,
            height: 2,
            z: 9999,
            locked: true,
            // 💡 스크린 패널 이미지 주소를 여기에 넣어주세요.
            imageUrl: PING_ICON_URL,
            coverImageUrl: PING_ICON_URL,
            closed: true
          })

          // console.log(`[Ping] 📍 핑 생성됨! (2초 후 회수)`)

          // 2. 정확히 3초 뒤에 회수 작전 시작
          setTimeout(async () => {
            try {
              const { store } = getServices()
              const state = store.getState()

              // 내 계정의 UID (내가 찍은 핑만 지우기 위해)
              const myUid = state.app?.state?.uid

              // 코코포리아에 등록된 모든 스크린 패널(roomItem) 목록을 가져옵니다.
              const roomItems = state.entities?.roomItems?.entities || {}

              // 명찰(name)이 일치하고, 내가(owner) 만든 토큰의 ID만 싹둑 골라냅니다.
              const targetIds = Object.keys(roomItems).filter((id) => {
                const item = roomItems[id]
                return item && item.memo === PING_IDENTIFIER
              })

              // 찾아낸 핑 ID들을 삭제 API에 넘겨줍니다.
              for (const targetId of targetIds) {
                // 기존에 구현하신 delete 함수 호출 (알아서 roomItem임을 파악하고 지워줄 것입니다)
                await ccf.tokens.delete(targetId)
              }

              // if (targetIds.length > 0) {
              //   console.log(`[Ping] 📍 핑 회수 완료`)
              // }
            } catch (err) {
              console.error("[Ping] 핑 회수 중 에러:", err)
            } finally {
              // 💡 3. 성공하든 실패하든 3초 뒤에는 무조건 쿨다운을 초기화해줍니다!
              isPingActive = false
            }
          }, 2000)
        } catch (error) {
          console.error("[Ping] 핑 생성 에러:", error)
          // 생성 과정에서 에러가 났다면 즉시 쿨다운을 풀어줍니다.
          isPingActive = false
        }
      }
    },
    { capture: true }
  )
}
