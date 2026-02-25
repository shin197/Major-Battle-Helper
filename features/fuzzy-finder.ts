// major-battle/inject-fuzzy.ts (MAIN 세계에서 실행되어야 합니다!)

export function initNativeFuzzyHijack() {
  const observer = new MutationObserver(() => {
    const menu = document.querySelector('ul[id^="downshift-"][id$="-menu"]')
    if (!menu) return

    // React Fiber 객체 가져오기 (MAIN 환경에서만 가능)
    const fiberKey = Object.keys(menu).find((k) =>
      k.startsWith("__reactFiber$")
    )
    if (!fiberKey) return

    let fiber = (menu as any)[fiberKey]
    let depth = 0

    // 부모 컴포넌트로 타고 올라가며 상태 찾기 (안전하게 15층까지만 탐색)
    while (fiber && depth < 15) {
      let hook = fiber.memoizedState

      while (hook) {
        const state = hook.memoizedState

        // 탐색된 시그니처 패턴 매칭:
        // state[0] = 화면에 보이는 리스트
        // state[1][0] = 전체 원본 명령어 리스트
        // state[1][1] = 현재 검색어 ('공' 등)
        if (
          Array.isArray(state) &&
          state.length === 2 &&
          Array.isArray(state[1]) &&
          state[1].length === 2 &&
          typeof state[1][1] === "string"
        ) {
          const currentVisibleList = state[0]
          const fullCommandList = state[1][0]

          if (Array.isArray(fullCommandList)) {
            // 무한 루프 방지: 이미 주입되었는지 확인
            if (!fullCommandList.includes("란란루데하하하")) {
              // 1. 전체 원본 리스트에 우리가 만든 명령어 슬쩍 우겨넣기
              fullCommandList.push("란란루데하하하")

              // 2. 만약 현재 검색어가 비어있거나 '란' 였다면, 당장 화면에도 보이게 추가
              if (!currentVisibleList.includes("란란루데하하하")) {
                currentVisibleList.push("란란루데하하하")
              }

              // 3. React에게 상태가 변했음을 알리기 위해 채팅창에 가짜 input 이벤트 트리거
              const ta = document.querySelector(
                'textarea[id^="downshift-"][id$="-input"]'
              )
              if (ta) {
                ta.dispatchEvent(new Event("input", { bubbles: true }))
              }

              console.log(
                "🚀 [BattleHelper] 퍼지 파인더에 네이티브 명령어가 주입되었습니다!"
              )
            }
            return // 찾아서 주입했으므로 더 이상 탐색할 필요 없음
          }
        }
        hook = hook.next
      }
      fiber = fiber.return
      depth++
    }
  })

  // 채팅창 메뉴가 열리거나 글자가 입력되어 갱신될 때마다 옵저버 실행
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-hidden"]
  })
}

// 스크립트가 로드되면 즉시 실행
initNativeFuzzyHijack()
