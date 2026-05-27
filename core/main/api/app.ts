import { getServices } from "../hijack"

let _pickerActive = false

export const app = {
  /**
   * 코코포리아 자체 이미지 선택 창을 띄우고 선택된 이미지 URL을 반환합니다.
   * 이미지가 선택되지 않고 창이 닫히면 null을 반환합니다.
   */
  openImagePicker: async (): Promise<string | null> => {
    const { store } = getServices()
    if (!store || _pickerActive) return null

    _pickerActive = true
    let _pickerGotResult = false

    return new Promise((resolve) => {
      // 1) Redux 상태를 변경해 네이티브 이미지 피커 열기
      const appState = store.getState().app.state
      store.dispatch({
        type: "app/state/seted",
        payload: {
          ...appState,
          openRoomImageSelect: true,
          openRoomImageSelectDir: "item",
          openRoomImageSelectTarget: "mb/ext"
        }
      })

      // 2) 클릭 이벤트 캡처로 선택된 이미지 가로채기
      const onDocClick = (e: MouseEvent) => {
        const pickerDialog = document.querySelector('.MuiDialog-paperWidthMd[role="dialog"]')
        if (!pickerDialog || !pickerDialog.contains(e.target as Node)) return

        let imgEl: HTMLImageElement | null = null
        const target = e.target as HTMLElement

        if (target.tagName === "IMG") {
          imgEl = target as HTMLImageElement
        } else {
          imgEl = target.querySelector(":scope > img") as HTMLImageElement
        }

        if (!imgEl || !imgEl.src) return

        // UI 버튼 아이콘인지 검사 (실제 업로드된 파일 이미지여야 함)
        if (
          imgEl.closest("button:not(.MuiButtonBase-root)") ||
          imgEl.closest("header") ||
          imgEl.closest('[role="tab"]')
        ) return

        if (!imgEl.src.startsWith("https://")) return

        _pickerGotResult = true
        _sendResult(imgEl.src)
      }

      document.addEventListener("click", onDocClick, true) // capture phase

      // 3) Redux Store 감시 (피커 닫힘 감지)
      const unsub = store.subscribe(() => {
        const s = store.getState().app.state
        if (!s.openRoomImageSelect && _pickerActive) {
          _pickerActive = false
          unsub()
          document.removeEventListener("click", onDocClick, true)
          // 아무 선택 없이 창이 닫힘 (취소)
          if (!_pickerGotResult) {
            _sendResult(null)
          }
        }
      })

      // 4) 타임아웃 
      const fallbackTimeout = setTimeout(() => {
        if (_pickerActive) {
          _pickerActive = false
          try { unsub() } catch (e) { }
          document.removeEventListener("click", onDocClick, true)
          if (!_pickerGotResult) _sendResult(null)
        }
      }, 60000)

      function _sendResult(url: string | null) {
        clearTimeout(fallbackTimeout)
        resolve(url)
      }
    })
  },

  /**
   * Redux의 app.state(UI 상태)를 변경합니다.
   * 예: { openRoomImageSelect: false, openRoomCharacter: false }
   */
  stateMutate: (updates: Record<string, any>) => {
    const { store } = getServices()
    if (!store) return

    const currentState = store.getState().app.state
    store.dispatch({
      type: "app/state/seted",
      payload: { ...currentState, ...updates }
    })
  }
}
