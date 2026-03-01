// features/image-magnifier.ts
import { lastMousePos } from "~utils/mouse-tracker"

let overlay: HTMLDivElement | null = null
let overlayImg: HTMLImageElement | null = null
let isCtrlPressed = false

// 오버레이 UI 초기화 함수
function createOverlay() {
  if (overlay) return

  overlay = document.createElement("div")
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    backdropFilter: "blur(4px)", // 배경을 예쁘게 흐리게 만듭니다
    zIndex: "999999",
    display: "none",
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none", // 클릭이나 드래그를 방해하지 않도록 통과시킵니다
    opacity: "0",
    transition: "opacity 0.15s ease-in-out"
  })

  overlayImg = document.createElement("img")
  Object.assign(overlayImg.style, {
    maxWidth: "85%",
    maxHeight: "85%",
    objectFit: "contain",
    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
    borderRadius: "12px",
    transform: "scale(0.95)",
    transition: "transform 0.15s ease-out"
  })

  overlay.appendChild(overlayImg)
  document.body.appendChild(overlay)
}

function showOverlay(src: string) {
  if (!overlay || !overlayImg) return

  if (overlayImg.src !== src) overlayImg.src = src
  overlay.style.display = "flex"

  // 브라우저 렌더링 틱을 기다린 후 트랜지션(애니메이션) 적용
  requestAnimationFrame(() => {
    overlay!.style.opacity = "1"
    overlayImg!.style.transform = "scale(1)"
  })
}

function hideOverlay() {
  if (!overlay || !overlayImg) return

  overlay.style.opacity = "0"
  overlayImg.style.transform = "scale(0.95)"

  // 애니메이션이 끝난 뒤에 완전히 숨김
  setTimeout(() => {
    if (!isCtrlPressed && overlay) {
      overlay.style.display = "none"
    }
  }, 150)
}

function checkAndMagnify() {
  if (!isCtrlPressed) return

  // 1. 현재 마우스 위치에 있는 DOM 요소를 가져옵니다.
  const target = document.elementFromPoint(
    lastMousePos.x,
    lastMousePos.y
  ) as HTMLElement
  if (!target) {
    hideOverlay()
    return
  }

  // 2. 대상 요소 근처에서 <img> 태그를 필사적으로 찾습니다.
  let imgEl = target.tagName === "IMG" ? (target as HTMLImageElement) : null

  // 자식 중에 있는가?
  if (!imgEl) imgEl = target.querySelector("img")

  // 부모 쪽에 있는가? (최대 3계층 탐색)
  if (!imgEl) {
    let current = target.parentElement
    let depth = 0
    while (current && depth < 3) {
      imgEl = current.querySelector("img")
      if (imgEl) break
      current = current.parentElement
      depth++
    }
  }

  // 3. 이미지를 찾았다면 띄워줍니다.
  if (imgEl && imgEl.src) {
    // 💡 예외 처리: 보드 배경판처럼 화면 절반 이상을 차지하는 거대 이미지는 무시합니다.
    if (imgEl.clientWidth > window.innerWidth * 0.5) {
      hideOverlay()
      return
    }
    showOverlay(imgEl.src)
  } else {
    hideOverlay()
  }
}

export function initImageMagnifier() {
  createOverlay()

  // Ctrl 키가 눌렸을 때
  window.addEventListener("keydown", (e) => {
    if ((e.key === "e" || e.key === "E") && !isCtrlPressed) {
      isCtrlPressed = true
      checkAndMagnify()
    }
  })

  // Ctrl 키를 뗐을 때
  window.addEventListener("keyup", (e) => {
    if (e.key === "e" || e.key === "E") {
      isCtrlPressed = false
      hideOverlay()
    }
  })

  // Ctrl을 누른 채로 다른 토큰으로 마우스를 옮길 때 실시간으로 이미지 변경
  window.addEventListener(
    "pointermove",
    () => {
      if (isCtrlPressed) {
        checkAndMagnify()
      }
    },
    { passive: true }
  )
}
