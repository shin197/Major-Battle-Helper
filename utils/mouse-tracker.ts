// utils/mouse-tracker.ts

import { getBoardTable } from "./elements"

export const lastMousePos = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2
}

let fallbackBoardElement: HTMLElement | null = null

export function initMouseTracker() {
  document.addEventListener(
    "pointermove",
    (e: PointerEvent) => {
      lastMousePos.x = e.clientX
      lastMousePos.y = e.clientY
      getGridCoordinateFromMouse(e.clientX, e.clientY) // 보드판이 감지된 순간 좌표 변환도 시도해봄
      const target = e.target as HTMLElement
      if (
        target &&
        target.tagName === "DIV" &&
        target.offsetWidth > window.innerWidth * 0.5
      ) {
        fallbackBoardElement = target
      }
    },
    { capture: true, passive: true }
  )
}

// 3. 화면 픽셀 좌표를 코코포리아 그리드 좌표로 변환하는 핵심 함수
export function getGridCoordinateFromMouse(
  clientX = lastMousePos.x,
  clientY = lastMousePos.y
) {
  const zoomEl = getBoardElement()
  const GRID_SIZE = 24

  if (zoomEl) {
    // 1. Zoom(배율) 값 직접 추출
    // "transform: scale(0.6);" 문자열에서 0.6 추출
    const scaleMatch = zoomEl.style.transform.match(/scale\(([^)]+)\)/)
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1

    // 2. 화면 상의 보드(0,0) 영점 좌표 가져오기
    // 부모의 translate(이동) 값이 모두 반영된 최종 화면 좌표계(left, top)가 나옵니다.
    const rect = zoomEl.getBoundingClientRect()

    // 3. 실제 마우스 좌표에서 보드의 영점을 빼고, 현재 줌 배율로 나누어 실제 보드 내부 픽셀 구하기
    const boardPixelX = (clientX - rect.left) / scale
    const boardPixelY = (clientY - rect.top) / scale

    // 4. 그리드 단위(24)로 쪼개고 반올림
    const gridX = Math.round(boardPixelX / GRID_SIZE)
    const gridY = Math.round(boardPixelY / GRID_SIZE)

    // 콘솔에서 테스트하기 쉽게 로그 출력 (나중에 지우셔도 됩니다)
    // console.log(
    //   `🎯 [Tracker] 화면좌표(${clientX}, ${clientY}) -> 그리드좌표(${gridX}, ${gridY}) / 줌배율: ${scale}`
    // )

    return { x: gridX, y: gridY }
  }

  // 보드판을 못 찾았을 때의 최후 안전장치
  return {
    x: Math.round(clientX / GRID_SIZE),
    y: Math.round(clientY / GRID_SIZE)
  }
}

export function getBoardElement(): HTMLElement | null {
  // 스크린샷에서 확인된 직계 조상 노드의 특징: style 속성에 "scale"이 포함되어 있음
  const zoomElements = Array.from(
    document.querySelectorAll<HTMLElement>('div[style*="scale"]')
  )

  for (const el of zoomElements) {
    // scale이 적용된 div 중, 실제로 그 안에 무언가 들어있는 것을 진짜 보드판으로 간주
    if (el.children.length > 0) {
      return el
    }
  }

  // 찾지 못했다면 빈 공간(배경) 클릭 시 저장된 요소 반환
  return fallbackBoardElement
}
