import JsonDb from 'simple-json-db'
import { SelectFilmButtonInfo } from './shared'

export type DateStored = string

export type FilmCategory = {
  title: string
  description: string
  updatedAt: Date
}

export type FilmCategoryStored = Omit<FilmCategory, 'updatedAt'> & {
  updatedAt: DateStored
}

export type BaseFilmTitleAndId = {
  title: string
  id: string
}

export type FilmTitleAndId = BaseFilmTitleAndId & {
  isShorts?: boolean
  parentEventId?: string
  updatedAt: Date
}

export type FilmTitleAndIdStored = Omit<FilmTitleAndId, 'updatedAt'> & {
  updatedAt: DateStored
}

export type FilmBasicInfo = FilmTitleAndId & {
  url: string
  tagLine: string
}

export type FilmBasicInfoStored = Omit<FilmBasicInfo, 'updatedAt'> & {
  updatedAt: DateStored
}

export type Credit = {
  name: string
  values: string[]
}

export type FilmInfo = BaseFilmTitleAndId & {
  url: string
  panelist: {
    name: string
    description: string
  }
  category: string
  description: string
  tags: string[]
  credits: Credit[]
  updatedAt: Date
  films?: BaseFilmTitleAndId[]
}

export type FilmInfoStored = Omit<FilmInfo, 'updatedAt'> & {
  updatedAt: DateStored
}

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
  isEvent?: boolean
  ticketsPurchased?: number
  ticketsRemaining?: number
  updatedAt: Date
}

type ScreeningMoreInfoStored = Omit<ScreeningMoreInfo, 'updatedAt'> & {
  updatedAt: DateStored
}

export class Db {
  private readonly db = new JsonDb('storage.json')

  private static readonly allCategoriesKey = 'allCategories'

  get allCategories() {
    return new Set((this.db.get(Db.allCategoriesKey) || []) as string[])
  }

  set allCategories(allCategories: Set<string>) {
    this.db.set(Db.allCategoriesKey, Array.from(allCategories))
  }

  private static readonly categoriesKey = 'categories'

  get categories() {
    return new Set((this.db.get(Db.categoriesKey) || []) as string[])
  }

  set categories(categories: Set<string>) {
    this.db.set(Db.categoriesKey, Array.from(categories))
  }

  private static filmCategoryKey(category: string) {
    return `filmCategory-${category}`
  }

  setFilmCategory(
    category: string,
    info: FilmCategory,
  ) {
    this.db.set(Db.filmCategoryKey(category), info)
  }

  getFilmCategory(category: string): FilmCategory | undefined {
    const data = this.db.get(Db.filmCategoryKey(category)) as FilmCategoryStored | undefined
    return data && {
      ...data,
      updatedAt: new Date(data.updatedAt),
    }
  }

  private static readonly allFilmsKey = 'allFilms'

  get allFilms(): Map<string, FilmTitleAndId> {
    const data = (this.db.get(Db.allFilmsKey) || {}) as Record<string, FilmTitleAndIdStored>
    return new Map(Object.entries(data).map(([key, value]) => [
      key,
      {
        ...value,
        updatedAt: new Date(value.updatedAt),
      },
    ]))
  }

  set allFilms(allFilms: Map<string, FilmTitleAndId>) {
    const obj = Object.fromEntries(allFilms)
    this.db.set(Db.allFilmsKey, obj)
  }

  private static readonly filmsKey = 'films'

  get films(): Map<string, FilmTitleAndId> {
    const data = (this.db.get(Db.filmsKey) || {}) as Record<string, FilmTitleAndIdStored>
    return new Map(Object.entries(data).map(([key, value]) => [
      key,
      {
        ...value,
        updatedAt: new Date(value.updatedAt),
      },
    ]))
  }

  set films(films: Map<string, FilmTitleAndId>) {
    const obj = Object.fromEntries(films)
    this.db.set(Db.filmsKey, obj)
  }

  private static filmBasicInfoKey(id: string) {
    return `filmBasicInfo-${id}`
  }

  setFilmBasicInfo(
    id: string,
    info: FilmBasicInfo,
  ) {
    this.db.set(Db.filmBasicInfoKey(id), info)
  }

  getFilmBasicInfo(id: string) {
    const info = this.db.get(Db.filmBasicInfoKey(id)) as FilmBasicInfoStored | undefined
    return info && {
      ...info,
      updatedAt: new Date(info.updatedAt),
    }
  }

  private static filmInfoKey(id: string) {
    return `filmInfo-${id}`
  }

  setFilmInfo(
    id: string,
    info: FilmInfo,
  ) {
    this.db.set(Db.filmInfoKey(id), info)
  }

  getFilmInfo(id: string) {
    const info = this.db.get(Db.filmInfoKey(id)) as FilmInfoStored | undefined
    return info && {
      ...info,
      updatedAt: new Date(info.updatedAt),
    }
  }

  private static readonly programKey = 'program'

  get program() {
    return (this.db.get(Db.programKey) || []) as string[]
  }

  set program(program: string[]) {
    this.db.set(Db.programKey, program)
  }

  private static readonly screeningsKey = 'screenings'

  get screenings() {
    return new Set((this.db.get(Db.screeningsKey) || []) as string[])
  }

  set screenings(screenings: Set<string>) {
    this.db.set(Db.screeningsKey, Array.from(screenings))
  }

  private static readonly currentScreeningIdKey = 'currentScreeningId'

  get currentScreeningId() {
    return this.db.get(Db.currentScreeningIdKey) as string | undefined
  }

  set currentScreeningId(id: string | undefined) {
    this.db.set(Db.currentScreeningIdKey, id)
  }

  private static readonly scannedScreeningsKey = 'scannedScreenings'

  get scannedScreenings() {
    return new Set((this.db.get(Db.scannedScreeningsKey) || []) as string[])
  }

  set scannedScreenings(screenings: Set<string>) {
    this.db.set(Db.scannedScreeningsKey, Array.from(screenings))
  }

  private static basicInfoKey(screeningId: string) {
    return `basicInfo-${screeningId}`
  }

  setScreeningBasicInfo(
    screeningId: string,
    basicInfo: ScreeningBasicInfo
  ) {
    const {
      title,
      dateString,
      timeRangeString,
      location,
      isInParkCity,
      isInSaltLakeCity,
      isUnavailable,
      startTime,
      endTime,
      updatedAt,
    } = basicInfo
    this.db.set(
      Db.basicInfoKey(screeningId),
      {
        title,
        dateString,
        timeRangeString,
        location,
        isInParkCity,
        isInSaltLakeCity,
        isUnavailable,
        startTime,
        endTime,
        updatedAt,
      },
    )
  }

  getScreeningBasicInfo(screeningId: string): ScreeningBasicInfo | undefined {
    const data = this.db.get(Db.basicInfoKey(screeningId)) as ScreeningBasicInfoStored | undefined
    return data && {
      ...data,
      updatedAt: new Date(data.updatedAt),
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    }
  }

  private static moreInfoKey(screeningId: string) {
    return `moreInfo-${screeningId}`
  }

  setScreeningMoreInfo(
    screeningId: string,
    moreInfo: ScreeningMoreInfo,
  ) {
    const {
      screeningType,
      isPremiere,
      isSecondScreening,
      ticketType,
      isSoldOut,
      isEvent,
      ticketsPurchased,
      ticketsRemaining,
      updatedAt,
    } = moreInfo
    this.db.set(
      Db.moreInfoKey(screeningId),
      {
        screeningType,
        isPremiere,
        isSecondScreening,
        ticketType,
        isSoldOut,
        isEvent,
        ticketsPurchased,
        ticketsRemaining,
        updatedAt,
      },
    )
  }

  getScreeningMoreInfo(screeningId: string): ScreeningMoreInfo | undefined {
    const data = this.db.get(Db.moreInfoKey(screeningId)) as ScreeningMoreInfoStored | undefined
    return data && {
      ...data,
      updatedAt: new Date(data.updatedAt),
    }
  }
}

const db = new Db()
export default db
