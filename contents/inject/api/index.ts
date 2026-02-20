import { characters } from "./characters"
import { devtools } from "./devtools"
import { tokens } from "./tokens"

export const buildAPI = () => {
  return {
    characters,
    tokens,
    devtools
  }
}
