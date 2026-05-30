// contents/types.ts
export interface CcfoliaStatus {
  label: string
  value: number
  max: number
}

export interface CcfoliaParam {
  label: string
  value: string
}

export interface CcfoliaCharacterFace {
  label: string
  iconUrl: string
}

export interface CcfoliaCharacter {
  _id: string
  name: string
  status: CcfoliaStatus[]
  params: CcfoliaParam[]
  active: boolean
  secret: boolean
  invisible: boolean
  commands?: string
  owner?: string
  faces: CcfoliaCharacterFace[]
  externalUrl?: string
  memo: string
  color?: string
  hideStatus: boolean
  createdAt: number
  updatedAt: number
  [key: string]: any
}

export interface CcfoliaMember {
  _id: string
  displayName: string
  photoUrl: string
  role: string
  isAnonymous: boolean
  [key: string]: any
}

export interface CcfoliaDiceToken {
  _id: string
  faces: number
  closed: boolean
  value: number
  name: string
  owner: string
  x: number
  y: number
  [key: string]: any
}

export interface CcfoliaMessage {
  _id: string
  channelName: string
  channel: string
  color: string
  imageUrl: string
  toName: string
  iconUrl: string
  text: string
  updatedAt: {
    seconds: number
    nanoseconds: number
  },
  to: null,
  name: string,
  edited: boolean,
  createdAt: {
    seconds: number
    nanoseconds: number
  },
  type: string,
  from: string
}

export type CcReq = {
  id: string
  type: "ccfolia:call"
  method: string
  args: any[]
}

export interface AiSettings {
  apiKey: string
  systemPrompt: string
}

export type CcRes =
  | { id: string; type: "ccfolia:result"; ok: true; value: any }
  | { id: string; type: "ccfolia:result"; ok: false; error: string }

declare global {
  interface Window {
    webpackRequire: any
    __MY_REDUX: any
    ccfoliaAPI: any
    __CCFOLIA_MOD_CACHE__?: {
      fsId?: number
      dbId?: number
      selId?: number
      riaId?: number
      raId?: number
      appActionsId?: number
      deckActionsId?: number
      diceActionsId?: number
      noteActionsId?: number
    }
  }
}

