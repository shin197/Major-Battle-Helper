// 필요하다면 상단에 ccf API와 Toast 유틸을 임포트합니다.
// import { ccf } from "../core/isolated/ccfolia-api"
// import { showToast } from "../utils/isolated/toast"

import { ccf } from "~core/isolated/ccfolia-api"
import { showToast } from "~utils/isolated/toast"
import { getGridCoordinateFromMouse, lastMousePos } from "~utils/mouse-tracker"

export function initCustomClipboard() {
  // 문서 전체에서 발생하는 '붙여넣기(Ctrl+V)' 이벤트를 감시합니다.
  document.addEventListener(
    "paste",
    async (e: ClipboardEvent) => {
      if (!e.isTrusted) return

      // 1. 클립보드에 있는 텍스트 데이터 가져오기
      const clipboardText = e.clipboardData?.getData("text")
      if (!clipboardText) return

      try {
        // 2. 텍스트가 JSON 형식인지 파싱 시도 (일반 텍스트 복붙일 경우 여기서 에러가 나서 자연스럽게 무시됨)
        const parsed = JSON.parse(clipboardText)

        // ==========================================
        // 🌟 우리가 만든 '다중 토큰 꾸러미' 붙여넣기
        // ==========================================
        if (
          parsed &&
          parsed.kind === "battleHelperBundle" &&
          Array.isArray(parsed.items)
        ) {
          e.preventDefault()
          e.stopImmediatePropagation()

          // 📍 붙여넣는 순간의 마우스 위치를 새로운 '중심 영점'으로 삼습니다.
          const pasteOrigin = getGridCoordinateFromMouse(
            lastMousePos.x,
            lastMousePos.y
          )
          let successCount = 0

          for (const item of parsed.items) {
            const newPayload = { ...item.data }

            // 복사할 때 저장해둔 상대 좌표(dx, dy)를 새 마우스 위치에 더해줍니다. (진형 완벽 유지!)
            newPayload.x = pasteOrigin.x + item.dx
            newPayload.y = pasteOrigin.y + item.dy

            try {
              // 이전에 구현하신 ccf.tokens.create 호출
              // 주의: roomCharacter는 파라미터 구조가 복잡할 수 있으므로,
              // 우선 roomItem, roomMarker 등 지원하는 타입만 생성되도록 합니다.
              if (item.kind === "roomItem" || item.kind === "roomMarker") {
                // TODO: deck 만들기
                await ccf.tokens.create(item.kind as any, newPayload)
                successCount++
              }
            } catch (err) {
              console.error(`[API] ${item.kind} 생성 실패:`, err)
            }
          }
          showToast(`\u{1F4CB} ${successCount}개의 토큰을 붙여넣었습니다.`)
          // console.log(
          //   `[API] ✨ ${successCount}개의 토큰을 성공적으로 붙여넣었습니다!`
          // )
          return
        }
        // 3. 코코포리아 클립보드 규격(kind 속성 존재)인지 확인
        if (parsed && typeof parsed === "object" && parsed.kind) {
          // 4. 캐릭터 토큰은 코코포리아 네이티브 로직이 처리하도록 통과시킴
          if (parsed.kind === "character") return

          // 5. 우리가 확장할 커스텀 토큰 타입들
          const supportedTypes = [
            "roomItem",
            "roomMarker",
            "roomDice",
            "roomDeck"
          ]
          if (supportedTypes.includes(parsed.kind)) {
            // ✨ 핵심: 코코포리아가 알 수 없는 형식이라며 에러를 뿜는 것을 방지
            e.preventDefault()
            e.stopImmediatePropagation()

            // 복사될 때 담겨있던 실제 토큰 데이터
            const payload = parsed.data || {}

            // --- [선택적 고도화] 마우스 위치에 붙여넣기 ---
            // 원본 x, y 좌표를 무시하고 현재 화면 중앙이나 마우스 위치에 놓고 싶다면
            // 여기서 payload.x 와 payload.y 를 덮어씌울 수 있습니다.
            parsed.x = 0
            parsed.y = 0
            parsed.locked = false

            try {
              // 작성해두신 ccf.tokens.create API를 호출하여 토큰 생성
              await ccf.tokens.create(parsed.kind as any, payload)
              showToast(`✅ 토큰 붙여넣기 완료!`)
            } catch (createErr) {
              // console.error("[BattleHelper] 토큰 생성 중 에러:", createErr)
              showToast(`❌ 토큰 생성 실패`)
            }
          }
        }
      } catch (err) {
        // JSON.parse 에러: 일반 텍스트(채팅 등)를 붙여넣은 것이므로 무시합니다.
        return
      }
    },
    {
      // ✨ 핵심: 코코포리아의 기본 paste 이벤트보다 먼저 낚아채기 위해 capture 설정
      capture: true
    }
  )
}
