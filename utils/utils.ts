export const toNum = (s: string | undefined | null) => {
  if (s == null || s === "") return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
