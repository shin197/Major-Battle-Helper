// toast.ts ── 확장 util (Plasmo content script)
let snackbarTemplate: HTMLElement | null = null
let isObserverRunning = false // 💡 중복 실행 방지용 플래그

export function initToastObserver() {
  if (isObserverRunning) return // 이미 켜져있으면 무시

  new MutationObserver((muts) => {
    muts.forEach((mut) =>
      mut.addedNodes.forEach((n) => {
        if (
          n instanceof HTMLElement &&
          n.matches("div.MuiSnackbar-root.MuiSnackbar-anchorOriginBottomLeft")
        ) {
          snackbarTemplate = n.cloneNode(true) as HTMLElement
        }
      })
    )
  }).observe(document.body, { childList: true, subtree: true })

  isObserverRunning = true
}

/* 0. 토스트 전용 컨테이너 가져오기/생성 */
function ensureToastHost(base: HTMLElement): HTMLElement {
  const id = "plasmo-toast-container"
  let box = document.getElementById(id) as HTMLElement | null
  if (!box) {
    box = document.createElement("div")
    box.id = id
    Object.assign(box.style, {
      position: "fixed",
      bottom: "24px",
      left: "24px",
      zIndex: "1400",
      display: "flex",
      flexDirection: "column",
      gap: "8px" // 토스트 간 간격
    } as CSSStyleDeclaration)
    base.appendChild(box)
  }
  return box
}

export function showToast(msg: string, ms = 3000) {
  /* 👇 base 는 document.body 나 #root > div */
  // const base = document.querySelector("#root > div") || document.body
  const base = (document.querySelector<HTMLElement>("#root > div") ??
    document.body) as HTMLElement
  const host = ensureToastHost(base) // ← 컨테이너 확보

  /* 1. 토스트 DOM 준비 (기존 로직 거의 유지) */
  let toastRoot: HTMLElement
  if (snackbarTemplate) {
    toastRoot = snackbarTemplate.cloneNode(true) as HTMLElement
    toastRoot.querySelector<HTMLElement>(
      ".MuiSnackbarContent-message"
    )!.textContent = msg
  } else {
    toastRoot = buildFallback(msg) // ✨ buildFallback 그대로 사용
  }

  /* 2. 카드(`paper`) 선택 */
  const paper = toastRoot.querySelector(
    ".MuiSnackbarContent-root, .fallback-paper"
  ) as HTMLElement

  /* 3. 컨테이너 안에 삽입 */
  host.appendChild(paper) // wrapper 대신 paper 자체를 넣어도 OK

  /* 4. 등장·퇴장 애니메이션 */
  paper.style.opacity = "0"
  paper.style.transform = "translateY(100%)"
  requestAnimationFrame(() => {
    paper.style.opacity = "1"
    paper.style.transform = "none"
  })

  setTimeout(() => {
    paper.style.opacity = "0"
    paper.style.transform = "translateY(100%)"
    setTimeout(() => paper.remove(), 225)
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
