// utils/mouse-tracker.ts

// 1. 마지막 마우스 위치를 저장할 전역 변수 (기본값: 화면 정중앙)
export const lastMousePos = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2
}

// 2. 평소에 마우스가 움직일 때마다 위치를 갱신
export function initMouseTracker() {
  document.addEventListener(
    "pointermove",
    (e: PointerEvent) => {
      lastMousePos.x = e.clientX
      lastMousePos.y = e.clientY
      const pos = getGridCoordinateFromMouse()
      console.debug(
        `[MouseTracker] Updated mouse position: (${pos.x}, ${pos.y})`
      )
    },
    { capture: true, passive: true }
  )
}

// 3. 화면 픽셀 좌표를 코코포리아 그리드 좌표로 변환하는 핵심 함수
export function getGridCoordinateFromMouse(
  clientX = lastMousePos.x,
  clientY = lastMousePos.y
) {
  // 코코포리아의 토큰들이 담기는 가장 상위 컨테이너를 찾습니다.
  // (보통 줌/팬 transform이 걸려있는 드래그 가능한 보드판입니다)
  const boardElement = document.querySelector<HTMLElement>(
    'div[style*="transform"]'
  ) // 고쳐야함 (anchor로 붙잡아둘 필요가 있어보임)

  // 코코포리아 기본 그리드 사이즈 (캐릭터 생성 시 x:1, y:1 은 보통 24px 또는 48px 단위입니다)
  const GRID_SIZE = 24

  if (boardElement) {
    // getBoundingClientRect()는 현재 화면의 줌과 팬(이동)이 모두 반영된 실제 DOM의 크기와 위치를 반환합니다.
    const rect = boardElement.getBoundingClientRect()

    // transform: scale() 값 알아내기 (줌 배율)
    // getBoundingClientRect의 width와 원래 offsetWidth의 비율을 계산하여 줌 배율을 알아냅니다.
    const scale = rect.width / (boardElement.offsetWidth || 1)

    // 마우스 좌표에서 보드의 현재 이동된 위치(rect.left/top)를 빼서 순수 보드판 내의 픽셀 좌표를 구합니다.
    const boardPixelX = (clientX - rect.left) / scale
    const boardPixelY = (clientY - rect.top) / scale

    // 픽셀을 그리드 단위로 변환하고 반올림합니다.
    const gridX = Math.round(boardPixelX / GRID_SIZE)
    const gridY = Math.round(boardPixelY / GRID_SIZE)

    return { x: gridX, y: gridY }
  }

  // 만약 보드 요소를 찾지 못했다면 화면 중앙을 기준으로 임의의 그리드값을 반환 (안전장치)
  return {
    x: Math.round(clientX / GRID_SIZE),
    y: Math.round(clientY / GRID_SIZE)
  }
}
