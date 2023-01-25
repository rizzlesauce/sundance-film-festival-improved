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
} from '../shared/shared'
import db from '../shared/db'
import { Readable } from 'stream'

@Route('/')
export default class MainController {
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
   * @param filterCities Filter by `parkCity` or `slc`
   * @param filterTitles Filter by titles
   * @param soldOut Filter by sold out status
   * @param available Filter by screening availability
   * @param screeningType Filter by 1st or 2nd showing
   */
  @Get(MainController.getScreeningsPath)
  @Tags('Program')
  public getScreenings(
    @Query('sortBy') sortBy?: GetScreeningsSortBy,
    @Query('cities[]') filterCities?: GetScreeningsFilterCity[],
    @Query('titles[]') filterTitles?: string[],
    @Query('soldOut') soldOut?: boolean,
    @Query('available') available?: boolean,
    @Query('screeningType') screeningType?: GetScreeningsFilterPremiereType
  ) {
    return getScreenings({
      sortBy,
      filterCities,
      filterTitles,
      soldOut,
      available,
      screeningType,
    }).map(screening => ({
      ...screening,
      startTime: screening.startTime?.toLocaleString(),
      endTime: screening.endTime?.toLocaleString(),
      updatedAt: screening.updatedAt?.toLocaleString(),
    }))
  }

  static readonly screeningsCsvPath = '/screenings-csv'
  static readonly getScreeningsCsvPath = MainController.screeningsCsvPath
  /**
   * Retrieve screenings as a CSV document
   * @param sortBy
   * @param filterCities Filter by `parkCity` or `slc`
   * @param filterTitles Filter by titles
   * @param soldOut Filter by sold out status
   * @param available Filter by screening availability
   * @param screeningType Filter by 1st or 2nd showing
   */
  @Get(MainController.getScreeningsCsvPath)
  @Tags('Program')
  @Produces('text/csv')
  public getScreeningsCsv(
    @Query('sortBy') sortBy?: GetScreeningsSortBy,
    @Query('cities[]') filterCities?: GetScreeningsFilterCity[],
    @Query('titles[]') filterTitles?: string[],
    @Query('soldOut') soldOut?: boolean,
    @Query('available') available?: boolean,
    @Query('screeningType') screeningType?: GetScreeningsFilterPremiereType
  ) {
    const screenings = getScreenings({
      sortBy,
      filterCities,
      filterTitles,
      soldOut,
      available,
      screeningType,
    })
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
        title,
        startTime,
        endTime,
        screeningType,
        isPremiere,
        isSecondScreening,
        location,
        isInParkCity,
        isInSaltLakeCity,
        isSoldOut,
        ticketsPurchased,
        ticketsRemaining,
        isUnavailable,
        updatedAt,
      },
      index,
    ) => {
      stream.push(csvWriter.stringifyRecords([{
        id,
        title,
        startTime: startTime?.toISOString(),
        endTime: endTime?.toISOString(),
        screeningType,
        isPremiere,
        isSecondScreening,
        location,
        isInParkCity,
        isInSaltLakeCity,
        isSoldOut,
        ticketsPurchased,
        ticketsRemaining,
        isUnavailable,
        updatedAt: updatedAt?.toISOString(),
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
    const screening = getScreeningInfoStored(screeningId)
    return {
      ...screening,
      startTime: screening.startTime?.toLocaleString(),
      endTime: screening.endTime?.toLocaleString(),
      updatedAt: screening.updatedAt?.toLocaleString(),
    }
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
      return {
        ...data,
        info: data.info && {
          ...data.info,
          startTime: data.info.startTime?.toLocaleString(),
          endTime: data.info.endTime?.toLocaleString(),
          updatedAt: data.info.updatedAt?.toLocaleString(),
        }
      }
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
      if ((data.info?.ticketsPurchased ?? 0) !== (originalPurchased + quantity)) {
        throw new Error('Unable to purchase tickets')
      }
      return {
        ...data,
        info: data.info && {
          ...data.info,
          startTime: data.info.startTime?.toLocaleString(),
          endTime: data.info.endTime?.toLocaleString(),
          updatedAt: data.info.updatedAt?.toLocaleString(),
        }
      }
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
    return state
  }
}
