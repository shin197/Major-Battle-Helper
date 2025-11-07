export const toNum = (s: string | undefined | null) => {
  if (s == null || s === "") return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
