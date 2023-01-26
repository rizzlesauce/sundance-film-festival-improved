import JsonDb from 'simple-json-db'

export type DateStored = string

export type ScreeningBasicInfo = {
  title: string
  dateString: string
  timeRangeString: string
  location: string
  isInParkCity: boolean
  isInSaltLakeCity: boolean
  isUnavailable?: boolean
  startTime: Date
  endTime: Date
  updatedAt: Date
}

export type ScreeningBasicInfoStored = Omit<ScreeningBasicInfo, 'startTime' | 'endTime' | 'updatedAt'> & {
  startTime: DateStored
  endTime: DateStored
  updatedAt: DateStored
}

export type ScreeningMoreInfo = {
  screeningType: string
  isPremiere: boolean
  isSecondScreening: boolean
  ticketType?: string
  isSoldOut?: boolean
  ticketsPurchased?: number
  ticketsRemaining?: number
  updatedAt: Date
}

type ScreeningMoreInfoStored = Omit<ScreeningMoreInfo, 'updatedAt'> & {
  updatedAt: DateStored
}

export class Db {
  private readonly db = new JsonDb('storage.json')

  private static readonly programKey = 'program'

  get program(): string[] {
    return this.db.get(Db.programKey) || []
  }

  set program(program: string[]) {
    this.db.set(Db.programKey, program)
  }

  private static readonly screeningsKey = 'screenings'

  get screenings(): Set<string> {
    return new Set(this.db.get(Db.screeningsKey) || [])
  }

  set screenings(screenings: Set<string>) {
    this.db.set(Db.screeningsKey, Array.from(screenings))
  }

  private static readonly currentScreeningIdKey = 'currentScreeningId'

  get currentScreeningId(): string | undefined {
    return this.db.get(Db.currentScreeningIdKey)
  }

  set currentScreeningId(id: string | undefined) {
    this.db.set(Db.currentScreeningIdKey, id)
  }

  private static readonly scannedScreeningsKey = 'scannedScreenings'

  get scannedScreenings(): string[] {
    return this.db.get(Db.scannedScreeningsKey) || []
  }

  set scannedScreenings(screenings: string[]) {
    this.db.set(Db.scannedScreeningsKey, screenings)
  }

  private static basicInfoKey(screeningId: string) {
    return `basicInfo-${screeningId}`
  }

  setScreeningBasicInfo(
    screeningId: string,
    basicInfo: ScreeningBasicInfo
  ) {
    this.db.set(Db.basicInfoKey(screeningId), basicInfo)
  }

  getScreeningBasicInfo(screeningId: string): ScreeningBasicInfo | undefined {
    const data = this.db.get(Db.basicInfoKey(screeningId)) as ScreeningBasicInfoStored | undefined
    if (data) {
      return {
        ...data,
        updatedAt: new Date(data.updatedAt),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      }
    }
  }

  private static moreInfoKey(screeningId: string) {
    return `moreInfo-${screeningId}`
  }

  setScreeningMoreInfo(
    screeningId: string,
    moreInfo: ScreeningMoreInfo
  ) {
    this.db.set(Db.moreInfoKey(screeningId), moreInfo)
  }

  getScreeningMoreInfo(screeningId: string): ScreeningMoreInfo | undefined {
    const data = this.db.get(Db.moreInfoKey(screeningId)) as ScreeningMoreInfoStored | undefined
    if (data) {
      return {
        ...data,
        updatedAt: new Date(data.updatedAt),
      }
    }
  }
}

const db = new Db()
export default db
