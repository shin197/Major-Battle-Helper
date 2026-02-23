import { getServices } from "../hijack"

/**
 * [개발자 도구] 모듈 탐험 및 분석용 도구 모음
 */

export const devtools = {
  /**
   * 1. 특정 모듈 ID의 내용물을 콘솔에 출력합니다.
   * 사용법: ccfoliaAPI.devtools.inspect(51784)
   */

  inspect: (moduleId: number) => {
    try {
      const req = getServices().req
      if (!req) throw new Error("WebpackRequire 없음")

      const mod = req(moduleId)
      console.group(`📦 Module [${moduleId}] Inspector`)
      console.log("Exported Value:", mod)

      // 함수 목록만 따로 보여주기 (Signature 확인용)
      if (typeof mod === "object") {
        console.groupCollapsed("Functions List")
        Object.entries(mod).forEach(([key, val]) => {
          if (typeof val === "function") {
            console.log(`${key}:`, val.toString().slice(0, 50) + "...")
          }
        })
        console.groupEnd()
      }
      console.groupEnd()
      return mod
    } catch (e) {
      console.error(`모듈 ${moduleId} 로드 실패:`, e)
    }
  },

  /**
   * 2. 키워드로 모든 모듈을 검색합니다. (보물 찾기!)
   * 사용법: ccfoliaAPI.devtools.search("PlaySound")
   * 주의: 너무 짧은 키워드는 결과가 많을 수 있습니다.
   */
  search: (keyword: string) => {
    const req = getServices().req
    const modules = req.m // 모듈 팩토리 배열
    const results: Record<string, any> = {}

    console.log(`🔎 "${keyword}" 검색 시작...`)

    for (const id in modules) {
      try {
        // 모듈 소스코드(문자열)에서 검색 (로딩 전 탐색)
        const source = modules[id].toString()
        if (source.includes(keyword)) {
          console.log(`FOUND in Source [${id}]`)
          // 안전하게 로드 시도
          try {
            results[id] = req(id)
          } catch {
            results[id] = "(Load Error)"
          }
        }
      } catch (e) {}
    }

    console.log("검색 결과:", results)
    return results
  },

  /**
   * 3. 현재 로드된 모든 모듈의 ID 목록을 봅니다.
   */
  listAll: () => {
    console.log("Available Modules:", Object.keys(getServices().req.m))
  },

  /**
   * 4. [NEW] React Local State 스니퍼
   * 사용법: 마우스를 요소에 올린 뒤 콘솔에서 ccfoliaAPI.devtools.inspectLocalState() 실행
   */
  inspectLocalState: () => {
    // 현재 마우스가 올라간 DOM 요소를 찾습니다 (hover.js 같은 로직 응용)
    const hoveredElement = document.querySelector(":hover")
    if (!hoveredElement) {
      console.log("마우스를 화면의 요소 위에 올려두고 다시 실행해주세요.")
      return
    }

    // DOM에서 가장 깊숙한(마지막으로 마우스가 닿은) 요소 찾기
    const elements = document.querySelectorAll(":hover")
    const targetDom = elements[elements.length - 1] as HTMLElement

    const findFiber = (dom: HTMLElement) => {
      const key = Object.keys(dom).find((k) => k.startsWith("__reactFiber$"))
      return key ? (dom as any)[key] : null
    }

    console.group(`🕵️‍♂️ React Local State Inspector`)
    let node = findFiber(targetDom)
    let depth = 0

    // 부모 컴포넌트로 5단계만 거슬러 올라가며 탐색합니다.
    while (node && depth < 12) {
      const compName =
        node.type?.name ||
        (typeof node.type === "string" ? node.type : "Unknown")
      console.groupCollapsed(`[Depth ${depth}] Component: <${compName}>`)

      // 1. Props 출력 (부모가 준 데이터)
      console.log("🎁 Props:", node.memoizedProps)

      // 2. Local State 출력 (스스로 관리하는 데이터)
      if (node.memoizedState) {
        // Hooks 기반 함수형 컴포넌트인지 판별
        if (node.memoizedState.memoizedState !== undefined) {
          console.log("🧠 Local State (Hooks LinkedList):")
          let hook = node.memoizedState
          let index = 0
          while (hook) {
            console.log(`  └─ Hook[${index}]:`, hook.memoizedState)
            hook = hook.next
            index++
          }
        } else {
          // 클래스형 컴포넌트인 경우 (보통 객체 형태라 보기 편함)
          console.log("🧠 Local State (Class Object):", node.memoizedState)
        }
      } else {
        console.log("🧠 Local State: None")
      }

      console.groupEnd()
      node = node.return // 부모로 이동
      depth++
    }
    console.groupEnd()
  }
}
