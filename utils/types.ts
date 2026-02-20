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
  [key: string]: any
}

export type CcReq = {
  id: string
  type: "ccfolia:call"
  method: string
  args: any[]
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
    }
  }
}
