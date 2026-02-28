import { getOrFindAnchor, type AnchorSpec } from "./elements"

if (process.env.NODE_ENV === "development") {
  // 개발 모드일 때만 window 객체에 함수를 노출시킵니다.
  ;(window as any).debugAnchors = bootstrapUiAnchors
  console.log(
    "🛠️ [Debug] 콘솔에 window.debugAnchors() 를 입력하면 DOM 스캔을 시작합니다."
  )
}

// 💡 모든 주요 DOM 요소의 탐색 규칙을 한곳에 모아 관리합니다.
export const ANCHOR_SPECS = {
  // 예시: 캐릭터 이름 입력창 (elements.ts에 있던 하드코딩 이동)
  CHAR_NAME_INPUT: {
    key: "char-name-input",
    selector:
      "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > div:nth-child(2) > div > div > input"
  } as AnchorSpec<HTMLInputElement>,

  // 예시: 사이드 캐릭터 리스트 (elements.ts에 있던 하드코딩 이동)
  SIDE_CHAR_LIST: {
    key: "side-char-list",
    selector: "#root > div > div:nth-of-type(2) > div:nth-of-type(8)"
  } as AnchorSpec<HTMLDivElement>,

  // 예시: 채팅 입력창
  CHAT_INPUT: {
    key: "chat-input",
    selector: 'textarea[id^="downshift"]'
  } as AnchorSpec<HTMLTextAreaElement>,

  TABLE_CONTAINER: {
    key: "table-container",
    selector: "#root > div > div:nth-of-type(2) > div > div > div > div"
  } as AnchorSpec<HTMLDivElement>,
  CHARACTER_NAME_INPUT: {
    key: "character-name-input",
    selector:
      "#root > div > div.MuiDrawer-root.MuiDrawer-docked> div > div > form > div:nth-child(2) > div > div > input"
  } as AnchorSpec<HTMLInputElement>,
  CHARACTER_CHAT_PALETTE_EDIT_BTN: {
    key: "character-chat-palette-edit-btn",
    selector:
      "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > div:nth-child(2) > div:nth-child(3) > button"
  } as AnchorSpec<HTMLButtonElement>,
  CHARACTER_LIST_BTN: {
    key: "character-list-btn",
    selector: "#root > div > header > div > button:nth-child(3)"
  } as AnchorSpec<HTMLButtonElement>
  // ... 기타 필요한 요소들 추가 ...
}

// 기존의 bootstrapUiAnchors()는 이제 필요 없거나,
// 꼭 처음에 다 찾아둬야 한다면 getOrFindAnchor를 Promise.all로 돌리는 정도로 가볍게 바꿉니다.
export async function bootstrapUiAnchors() {
  console.log("[anchors] Pre-fetching anchors...")

  // 1. 키 이름(예: CHAR_NAME_INPUT)과 스펙을 함께 순회하기 위해 entries 사용
  const entries = Object.entries(ANCHOR_SPECS)

  // 2. 모든 요소 탐색을 병렬로 실행하고 결과를 배열로 받음
  const results = await Promise.all(
    entries.map(([, spec]) => getOrFindAnchor(spec as AnchorSpec<HTMLElement>))
  )

  // 3. 콘솔에 출력할 디버깅용 객체 조립
  const debugReport: Record<string, any> = {}
  let successCount = 0

  entries.forEach(([constantName, spec], index) => {
    const el = results[index]
    if (el) {
      // 찾은 경우 DOM 요소 자체를 값으로 넣음 (콘솔에서 마우스 호버로 확인 가능)
      debugReport[constantName] = el
      successCount++
    } else {
      // 못 찾은 경우 명시적으로 표시
      debugReport[constantName] = "❌ Not Found"
    }
  })

  // 4. 결과 출력
  console.log(
    `[anchors] Pre-fetch done. (${successCount}/${entries.length} found)`
  )

  // 표 형태로 깔끔하게 렌더링 (개발자 도구에서 아주 보기 좋습니다!)
  console.table(debugReport)
}
