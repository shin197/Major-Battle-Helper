function uuid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function callCcfolia<T = any>(method: string, ...args: any[]): Promise<T> {
  const id = uuid()

  return new Promise<T>((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window) return
      const data = ev.data
      if (!data || data.type !== "ccfolia:result" || data.id !== id) return

      window.removeEventListener("message", onMsg)

      if (data.ok) resolve(data.value as T)
      else reject(new Error(data.error))
    }

    window.addEventListener("message", onMsg)

    window.postMessage(
      { id, type: "ccfolia:call", method, args },
      "*"
    )

    // 옵션: 타임아웃
    setTimeout(() => {
      window.removeEventListener("message", onMsg)
      reject(new Error("ccfolia RPC timeout"))
    }, 5000)
  })
}

setTimeout(() => {
    // callCcfolia("setStatus", "크시카", "HP", 1);
    callCcfolia("inspect", "크시카");
}, 5000)
// 사용 예시

