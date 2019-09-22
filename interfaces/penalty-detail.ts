export interface PenaltyDetail {
    matricula: string,
    checkageDay: Date,
    banUntil: Date,
    banCount: number,
    email?: string,
    days: string[]
  }