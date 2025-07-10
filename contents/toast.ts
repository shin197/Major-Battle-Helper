// toast.ts ── 확장 util (Plasmo content script)
let snackbarTemplate: HTMLElement | null = null

/* 1. 최초 탐지: MutationObserver로 원본 스낵바 캐싱 */
new MutationObserver((muts) => {
  muts.forEach((mut) =>
    mut.addedNodes.forEach((n) => {
      if (
        n instanceof HTMLElement &&
        n.matches("div.MuiSnackbar-root.MuiSnackbar-anchorOriginBottomLeft")
      ) {
        // 깊이 복사해 두고 원본은 그대로 두기
        snackbarTemplate = n.cloneNode(true) as HTMLElement
      }
    })
  )
}).observe(document.body, { childList: true, subtree: true })

/* 2. 토스트 호출 함수 */
export function showToast(msg: string, ms = 3000) {
  const host = document.querySelector("#root > div") || document.body

  // 2-a) 템플릿이 있으면 그대로 clone → 스타일 100 % 유지
  let root: HTMLElement
  if (snackbarTemplate) {
    root = snackbarTemplate.cloneNode(true) as HTMLElement
    // message 영역만 교체
    const msgBox = root.querySelector(
      ".MuiSnackbarContent-message"
    ) as HTMLElement
    if (msgBox) msgBox.textContent = msg
  } else {
    // 2-b) 템플릿 없으면 Fallback 빌드
    root = buildFallback(msg)
  }

  host.appendChild(root)

  // 등장 애니메이션
  const paper = root.querySelector(
    ".MuiSnackbarContent-root, .fallback-paper"
  ) as HTMLElement
  paper.style.opacity = "0"
  paper.style.transform = "translateY(100%)"
  requestAnimationFrame(() => {
    paper.style.opacity = "1"
    paper.style.transform = "none"
  })

  // 자동 퇴장
  setTimeout(() => {
    paper.style.opacity = "0"
    paper.style.transform = "translateY(100%)"
    setTimeout(() => root.remove(), 225)
  }, ms)
}

/* 3. Fallback 생성기 (해시 몰라도 최소한의 스타일 유지) */
function buildFallback(message: string): HTMLElement {
  const wrapper = document.createElement("div")
  wrapper.role = "presentation"
  wrapper.className =
    "MuiSnackbar-root MuiSnackbar-anchorOriginBottomLeft fallback-root"
  Object.assign(wrapper.style, {
    position: "fixed",
    bottom: "24px",
    left: "24px",
    zIndex: "1400",
    display: "flex",
    flexDirection: "column-reverse"
  } as CSSStyleDeclaration)

  const paper = document.createElement("div")
  paper.className = "fallback-paper"
  Object.assign(paper.style, {
    background: "rgba(50,50,50,.88)",
    color: "#fff",
    padding: "6px 16px",
    borderRadius: "4px",
    fontSize: ".875rem",
    lineHeight: "1.43",
    boxShadow:
      "0px 3px 5px -1px rgba(0,0,0,.2)," +
      "0px 5px 8px 0px rgba(0,0,0,.14)," +
      "0px 1px 14px 0px rgba(0,0,0,.12)",
    maxWidth: "344px"
  } as CSSStyleDeclaration)

  const msgBox = document.createElement("div")
  msgBox.textContent = message
  paper.appendChild(msgBox)
  wrapper.appendChild(paper)
  return wrapper
}
