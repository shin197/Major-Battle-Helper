/**
 * DOM에 특정 요소가 나타날 때까지 대기
 * @param selector   CSS 선택자
 * @param options
 *   - root            관찰 시작 루트 (default: document)
 *   - timeout         ms, 0이면 무한 대기 (default: 10_000)
 *   - rejectOnTimeout true → reject, false → resolve(null) (default: true)
 */
export function waitFor<T extends HTMLElement = HTMLElement>(
  selector: string,
  {
    root = document,
    timeout = 10_000,
    rejectOnTimeout = false
  }: {
    root?: ParentNode
    timeout?: number
    rejectOnTimeout?: boolean
  } = {}
): Promise<T | null> {
  const start = (root as ParentNode).querySelector<T>(selector)
  if (start) return Promise.resolve(start)

  return new Promise((resolve, reject) => {
    const done = (value: T | null, isTimeout = false) => {
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
      isTimeout && rejectOnTimeout ? reject(new Error(`waitFor: ${selector} timed out`))
                                   : resolve(value)
    }

    const observer = new MutationObserver(() => {
      const found = (root as ParentNode).querySelector<T>(selector)
      if (found) done(found)
    })

    observer.observe(root as Node, { childList: true, subtree: true })

    const timeoutId =
      timeout > 0
        ? setTimeout(() => done(null, true), timeout)
        : 0
  })
}