export const toNum = (s: string | undefined | null) => {
  if (s == null || s === "") return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
export const generateRandomId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let autoId = ''
    for (let i = 0; i < 20; i++) {
        autoId += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return autoId
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const uuid = () => {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}