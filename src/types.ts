export interface PrizeTier {
  rank: number
  amount: string // human-readable USDC, e.g. "20"
}

export interface CreateEventForm {
  name: string
  minNumber: string
  maxNumber: string
  registrationDeadline: string // datetime-local string
  maxRegistrations: string
  prizes: PrizeTier[]
}

export type AppView = 'home' | 'create' | 'event' | 'result' | 'myevents'
