import {
  Delete,
  Get,
  Path,
  Post,
  Produces,
  Put,
  Query,
  Response,
  Route,
  Tags,
} from 'tsoa'
import { createObjectCsvStringifier } from 'csv-writer'
import {
  createWebDriver,
  signIn,
  refreshProgram,
  clearCart,
  refreshScreeningInfo,
  getScreenings,
  startOp,
  endOp,
  state,
  GetScreeningsSortBy,
  getScreeningInfoStored,
  GetScreeningsFilterCity,
  GetScreeningsFilterPremiereType,
  csvHeader,
  refreshCategories,
  refreshFilmInfoFromTitleSearch,
  refreshFilms,
  refreshFilmInfoFromId,
  filterBySearchStrings,
  pruneFilmInfo,
  FilmInfoVerbosity,
  refreshShortsInfoFromId,
  getFilmInfoStoredComplete,
  pruneScreeningInfo,
} from '../shared/shared'
import db from '../shared/db'
import { Readable } from 'stream'

@Route('/')
export default class MainController {
  static readonly refreshCategoriesPath = '/refresh-categories'
  @Post(MainController.refreshCategoriesPath)
  @Tags('Categories')
  public async refreshCategories() {
    const driver = await createWebDriver()
    try {
      return await refreshCategories(driver)
    } finally {
      await driver.close()
    }
  }

  static readonly categoriesPath = '/categories'
  static readonly getCategoriesPath = MainController.categoriesPath
  @Get(MainController.getCategoriesPath)
  @Tags('Categories')
  public async getCategories(
    @Query('all') all?: boolean,
    @Query('titles[]') titles?: string[],
  ) {
    let result = Array.from(all ? db.allCategories : db.categories).map(title => ({
      title,
      ...db.getFilmCategory(title),
    }))
    if (titles) {
      result = filterBySearchStrings({
        needles: titles,
        haystack: result,
        getValues: category => [category.title],
      })
    }
    return result
  }

  static readonly refreshFilmsPath = '/refresh-films'
  @Post(MainController.refreshFilmsPath)
  @Tags('Films')
  public async refreshFilms() {
    const driver = await createWebDriver()
    try {
      const result = await refreshFilms(driver)
      // TODO: only refresh this other stuff if specified with query param option
      for (const film of result) {
        if (film.isShorts) {
          await refreshShortsInfoFromId(driver, film.id)
        } else {
          await refreshFilmInfoFromId(driver, film.id)
        }
      }
      return result
    } finally {
      await driver.close()
    }
  }

  static readonly filmsPath = '/films'
  static readonly getFilmsPath = MainController.filmsPath
  @Get(MainController.getFilmsPath)
  @Tags('films')
  public async getFilms(
    @Query('all') all?: boolean,
    @Query('titles[]') titles?: string[],
    @Query('ids[]') ids?: string[],
    @Query('categories[]') categories?: string[],
    @Query('tags[]') tags?: string[],
    @Query('shorts') shorts?: boolean,
    @Query('verbosity') verbosity?: FilmInfoVerbosity,
  ) {
    let result = Array.from((all ? db.allFilms : db.films).values())
      .map(film => getFilmInfoStoredComplete(film))
    if (shorts !== undefined) {
      result = result.filter(film => !!film.isShorts === shorts)
    }
    if (ids) {
      result = filterBySearchStrings({
        needles: ids,
        haystack: result,
        getValues: film => [film.id],
      })
    }
    if (titles) {
      result = filterBySearchStrings({
        needles: titles,
        haystack: result,
        getValues: film => [film.title],
      })
    }
    if (categories) {
      result = filterBySearchStrings({
        needles: categories,
        haystack: result,
        getValues: film => [...film.moreInfo?.category ?? []],
      })
    }
    if (tags) {
      result = filterBySearchStrings({
        needles: tags,
        haystack: result,
        getValues: film => film.moreInfo?.tags ?? [],
      })
    }
    return result.map(film => pruneFilmInfo({
      film,
      verbosity,
    }))
  }

  static readonly refreshFilmInfoPath = '/refresh-film-info'
  @Post(MainController.refreshFilmInfoPath)
  @Tags('Films')
  public async refreshFilmInfo(
    @Query('filmId') filmId?: string,
    @Query('shortsId') shortsId?: string,
    @Query('titleSearch') titleSearch?: string,
  ) {
    const driver = await createWebDriver()
    try {
      if (filmId) {
        return await refreshFilmInfoFromId(driver, filmId)
      }
      if (shortsId) {
        return await refreshShortsInfoFromId(driver, shortsId)
      }
      if (titleSearch) {
        return await refreshFilmInfoFromTitleSearch(driver, titleSearch)
      }
      throw new Error('missing `filmId` or `titleSearch` parameter')
    } finally {
      await driver.close()
    }
  }

  static readonly programPath = '/program'
  static readonly getProgramPath = MainController.programPath
  @Get(MainController.getProgramPath)
  @Tags('Program')
  public async getProgram() {
    return db.program
  }

  static readonly refreshProgramPath = '/refresh-program'
  @Post(MainController.refreshProgramPath)
  @Tags('Program')
  public async refreshProgram() {
    const driver = await createWebDriver()
    try {
      await startOp()
      await signIn(driver)
      await refreshProgram(driver)
    } finally {
      endOp()
      await driver.close()
    }
    return db.program
  }

  static readonly screeningsPath = '/screenings'
  static readonly getScreeningsPath = MainController.screeningsPath
  /**
   * Retrieve screenings
   * @param sortBy
   * @param filterVenues
   * @param filterCities
   * @param filterOtherCities
   * @param filterTitles Filter by titles
   * @param soldOut Filter by sold out status
   * @param available Filter by screening availability
   * @param screeningTypes
   * @param otherScreeningTypes
   * @param filterFilmIds
   * @param filterCategories
   * @param filterTags
   * @param verbosity
   */
  @Get(MainController.getScreeningsPath)
  @Tags('Program')
  public getScreenings(
    @Query('sortBy') sortBy?: GetScreeningsSortBy,
    @Query('venues[]') filterVenues?: string[],
    @Query('cities[]') filterCities?: GetScreeningsFilterCity[],
    @Query('otherCities[]') filterOtherCities?: string[],
    @Query('titles[]') filterTitles?: string[],
    @Query('soldOut') soldOut?: boolean,
    @Query('available') available?: boolean,
    @Query('screeningTypes[]') screeningTypes?: GetScreeningsFilterPremiereType[],
    @Query('otherScreeningTypes[]') otherScreeningTypes?: string[],
    @Query('filmIds[]') filterFilmIds?: string[],
    @Query('categories[]') filterCategories?: string[],
    @Query('tags[]') filterTags?: string[],
    @Query('verbosity') verbosity?: FilmInfoVerbosity,
  ) {
    return getScreenings({
      sortBy,
      filterVenues,
      filterCities: [...filterCities || [], ...filterOtherCities || []],
      filterTitles,
      soldOut,
      available,
      screeningTypes: [...screeningTypes || [], ...otherScreeningTypes || []],
      withFilmInfo: true,
      filterFilmIds,
      filterCategories,
      filterTags,
    }).map(screening => pruneScreeningInfo(screening, verbosity))
  }

  static readonly screeningsCsvPath = '/screenings-csv'
  static readonly getScreeningsCsvPath = MainController.screeningsCsvPath
  /**
   * Retrieve screenings as a CSV document
   * @param sortBy
   * @param filterVenues
   * @param filterCities
   * @param filterOtherCities
   * @param filterTitles Filter by titles
   * @param soldOut Filter by sold out status
   * @param available Filter by screening availability
   * @param screeningTypes
   * @param otherScreeningTypes
   * @param filterFilmIds
   * @param filterCategories
   * @param filterTags
   * @param verbosity
   */
  @Get(MainController.getScreeningsCsvPath)
  @Tags('Program')
  @Produces('text/csv')
  public getScreeningsCsv(
    @Query('sortBy') sortBy?: GetScreeningsSortBy,
    @Query('venues[]') filterVenues?: string[],
    @Query('cities[]') filterCities?: GetScreeningsFilterCity[],
    @Query('otherCities[]') filterOtherCities?: string[],
    @Query('titles[]') filterTitles?: string[],
    @Query('soldOut') soldOut?: boolean,
    @Query('available') available?: boolean,
    @Query('screeningTypes[]') screeningTypes?: GetScreeningsFilterPremiereType[],
    @Query('otherScreeningTypes[]') otherScreeningTypes?: string[],
    @Query('filmIds[]') filterFilmIds?: string[],
    @Query('categories[]') filterCategories?: string[],
    @Query('tags[]') filterTags?: string[],
    @Query('verbosity') verbosity?: FilmInfoVerbosity,
  ) {
    const screenings = getScreenings({
      sortBy,
      filterVenues,
      filterCities: [...filterCities || [], ...filterOtherCities || []],
      filterTitles,
      soldOut,
      available,
      screeningTypes: [...screeningTypes || [], ...otherScreeningTypes || []],
      withFilmInfo: true,
      filterFilmIds,
      filterCategories,
      filterTags,
    }).map(screening => pruneScreeningInfo(screening, verbosity))

    const stream = new Readable()
    const csvWriter = createObjectCsvStringifier({
      header: csvHeader.map(name => ({ id: name, title: name })),
    })

    const headerObject = csvHeader.reduce((prev, curr) => {
      return {
        ...prev,
        [curr]: curr,
      }
    }, {})

    stream.push(csvWriter.stringifyRecords([ headerObject ]))

    screenings.forEach((
      {
        id,
        basicInfo,
        moreInfo,
      },
      index,
    ) => {
      stream.push(csvWriter.stringifyRecords([{
        id,
        title: basicInfo?.title,
        startTime: basicInfo?.startTime.toISOString(),
        endTime: basicInfo?.endTime.toISOString(),
        screeningType: moreInfo?.screeningType,
        isPremiere: moreInfo?.isPremiere,
        isSecondScreening: moreInfo?.isSecondScreening,
        location: basicInfo?.location,
        isInParkCity: basicInfo?.isInParkCity,
        isInSaltLakeCity: basicInfo?.isInSaltLakeCity,
        isSoldOut: moreInfo?.isSoldOut,
        ticketsPurchased: moreInfo?.ticketsPurchased,
        ticketsRemaining: moreInfo?.ticketsRemaining,
        isUnavailable: basicInfo?.isUnavailable,
        updatedAt: moreInfo?.updatedAt.toISOString() ?? basicInfo?.updatedAt.toISOString(),
        index,
      }]))
    })

    stream.push(null)

    return stream
  }

  static readonly getScreeningPath = `/screenings/{screeningId}`
  static readonly getScreeningPathExpress = `/screenings/:screeningId`
  @Get(MainController.getScreeningPath)
  @Tags('Program')
  public getScreening(
    @Path('screeningId') screeningId: string
  ) {
    const screening = getScreeningInfoStored(screeningId, true)
    return screening
  }

  static readonly refreshScreeningInfoPath = '/refresh-screening/{screeningId}'
  static readonly refreshScreeningInfoPathExpress = '/refresh-screening/:screeningId'
  @Post(MainController.refreshScreeningInfoPath)
  @Tags('Program')
  public async refreshScreeningInfo(
    @Path('screeningId') screeningId: string
  ) {
    const driver = await createWebDriver()
    try {
      await startOp()
      await signIn(driver)
      await clearCart(driver)
      const data = await refreshScreeningInfo({ driver, screeningId })
      return data
    } finally {
      endOp()
      await driver.close()
    }
  }

  static readonly purchaseScreeningTicketsPath = '/purchase-tickets/{screeningId}'
  static readonly purchaseScreeningTicketsPathExpress = '/purchase-tickets/:screeningId'
  @Post(MainController.purchaseScreeningTicketsPath)
  @Tags('Cart')
  public async purchaseScreeningTickets(
    @Path('screeningId') screeningId: string,
    @Query('quantity') quantity: number,
  ) {
    const driver = await createWebDriver()
    try {
      await startOp()
      await signIn(driver)
      await clearCart(driver)
      const originalPurchased = (db.getScreeningMoreInfo(screeningId)?.ticketsPurchased ?? 0)
      const data = await refreshScreeningInfo({
        driver,
        screeningId,
        purchaseTicketCount: quantity,
      })
      const screening = data.info
      if ((screening?.moreInfo?.ticketsPurchased ?? 0) !== (originalPurchased + quantity)) {
        throw new Error('Unable to purchase tickets')
      }
      return data
    } finally {
      endOp()
      await driver.close()
    }
  }

  static readonly cartPath = '/cart'
  static readonly clearCartPath = MainController.cartPath
  static readonly clearCartStatus = 204
  @Delete(MainController.clearCartPath)
  @Response(MainController.clearCartStatus)
  @Tags('Cart')
  public async clearCart() {
    const driver = await createWebDriver()
    try {
      await startOp()
      await signIn(driver)
      await clearCart(driver)
    } finally {
      endOp()
      await driver.close()
    }
  }

  static readonly putRunningMainPath = '/running-main/{value}'
  static readonly putRunningMainPathExpress = '/running-main/:value'
  static readonly putRunningMainStatus = 204
  @Put(MainController.putRunningMainPath)
  @Response(MainController.putRunningMainStatus)
  @Tags('Program')
  public async setRunningMain(
    @Path('value') value: 'true' | 'false'
  ) {
    state.runningMain = value === 'true'
  }

  static readonly statePath = '/state'
  static readonly getStatePath = MainController.statePath
  @Get(MainController.getStatePath)
  @Tags('App')
  public getAppState() {
    return {
      ...state,
      currentScreeningId: db.currentScreeningId,
    }
  }
}
