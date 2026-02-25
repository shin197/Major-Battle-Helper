export function checkCurrentWorld() {
  // 1. chrome.runtime API 존재 여부로 확인
  // ISOLATED 세계는 크롬 확장 프로그램 API에 접근할 수 있지만, MAIN 세계는 보안상 접근이 차단됩니다.
  const isIsolated = typeof chrome !== "undefined" && !!chrome.runtime

  if (isIsolated) {
    console.log("🟦 현재 [ISOLATED] 세계에서 실행 중입니다.")
  } else {
    console.log("🟥 현재 [MAIN] 세계에서 실행 중입니다.")
  }
}
