import express, { Request } from 'express'
import { BoolString, FilmInfoVerbosity, GetScreeningsFilterCity, GetScreeningsFilterPremiereType as GetScreeningsFilterScreeningType, GetScreeningsSortBy } from 'src/shared/shared'
import MainController from '../controllers/MainController'

const router = express.Router()

router.post(MainController.refreshCategoriesPath, async (req, res, next) => {
  const controller = new MainController()
  try {
    const response = await controller.refreshCategories()
    return res.send(response)
  } catch (e) {
    next(e)
  }
})

router.get(
  MainController.getCategoriesPath,
  async (
    req: Request<
      never,
      any,
      never,
      {
        all?: BoolString
        titles?: string[]
      }
    >,
    res,
    next,
  ) => {
    const controller = new MainController()
    try {
      const response = await controller.getCategories(
        req.query.all && req.query.all === 'true',
        req.query.titles,
      )
      return res.send(response)
    } catch (e) {
      next(e)
    }
  }
)

router.post(MainController.refreshFilmsPath, async (req, res, next) => {
  const controller = new MainController()
  try {
    const response = await controller.refreshFilms()
    return res.send(response)
  } catch (e) {
    next(e)
  }
})

router.get(
  MainController.getFilmsPath,
  async (
    req: Request<
      never,
      any,
      never,
      {
        all?: BoolString
        titles?: string[]
        ids?: string[]
        categories?: string[]
        tags?: string[]
        shorts?: BoolString
        verbosity?: FilmInfoVerbosity
      }
    >,
    res,
    next,
  ) => {
    const controller = new MainController()
    try {
      const response = await controller.getFilms(
        req.query.all && req.query.all === 'true',
        req.query.titles,
        req.query.ids,
        req.query.categories,
        req.query.tags,
        req.query.shorts && req.query.shorts === 'true',
        req.query.verbosity,
      )
      return res.send(response)
    } catch (e) {
      next(e)
    }
  }
)

router.post(
  MainController.refreshFilmInfoPath,
  async (
    req: Request<
      never,
      any,
      never,
      {
        filmId?: string
        shortsId?: string
        titleSearch?: string
      }
    >,
    res,
    next,
  ) => {
    const controller = new MainController()
    try {
      const response = await controller.refreshFilmInfo(
        req.query.filmId,
        req.query.shortsId,
        req.query.titleSearch,
      )
      return res.send(response)
    } catch (e) {
      next(e)
    }
  }
)

router.post(MainController.refreshProgramPath, async (req, res, next) => {
  const controller = new MainController()
  try {
    const response = await controller.refreshProgram()
    return res.send(response)
  } catch (e) {
    next(e)
  }
})

router.get(MainController.getProgramPath, async (req, res, next) => {
  const controller = new MainController()
  try {
    const response = await controller.getProgram()
    return res.send(response)
  } catch (e) {
    next(e)
  }
})

router.post(MainController.refreshScreeningInfoPathExpress, async (req: Request<{ screeningId: string }>, res, next) => {
  const controller = new MainController()
  try {
    const response = await controller.refreshScreeningInfo(req.params.screeningId)
    return res.send(response)
  } catch (e) {
    next(e)
  }
})

router.post(
  MainController.purchaseScreeningTicketsPathExpress,
  async (
    req: Request<
      {
        screeningId: string
      },
      any,
      never,
      {
        quantity: string
      }
    >,
    res,
    next,
  ) => {
    const controller = new MainController()
    try {
      const response = await controller.purchaseScreeningTickets(
        req.params.screeningId,
        +req.query.quantity,
      )
      return res.send(response)
    } catch (e) {
      next(e)
    }
  }
)

router.get(
  MainController.getScreeningsPath,
  async (
    req: Request<
      never,
      any,
      never,
      {
        sortBy?: GetScreeningsSortBy
        venues?: string[]
        cities?: GetScreeningsFilterCity[]
        otherCities?: string[]
        titles?: string[]
        soldOut?: BoolString
        available?: BoolString
        screeningTypes?: GetScreeningsFilterScreeningType[]
        otherScreeningTypes?: string[]
        filmIds?: string[]
        categories?: string[]
        tags?: string[]
        verbosity?: FilmInfoVerbosity
      }
    >,
    res,
    next,
  ) => {
    const controller = new MainController()
    try {
      const response = controller.getScreenings(
        req.query.sortBy,
        req.query.venues,
        req.query.cities,
        req.query.otherCities,
        req.query.titles,
        req.query.soldOut && req.query.soldOut === 'true',
        req.query.available && req.query.available === 'true',
        req.query.screeningTypes,
        req.query.otherScreeningTypes,
        req.query.filmIds,
        req.query.categories,
        req.query.tags,
        req.query.verbosity,
      )
      return res.send(response)
    } catch (e) {
      next(e)
    }
  },
)

router.get(
  MainController.getScreeningsCsvPath,
  async (
    req: Request<
      never,
      any,
      never,
      {
        sortBy?: GetScreeningsSortBy
        venues?: string[]
        cities?: GetScreeningsFilterCity[]
        otherCities?: string[]
        titles?: string[]
        soldOut?: BoolString
        available?: BoolString
        screeningTypes?: GetScreeningsFilterScreeningType[]
        otherScreeningTypes?: string[]
        filmIds?: string[]
        categories?: string[]
        tags?: string[]
        verbosity?: FilmInfoVerbosity
      }
    >,
    res,
    next,
  ) => {
    const controller = new MainController()
    try {
      const response = controller.getScreeningsCsv(
        req.query.sortBy,
        req.query.venues,
        req.query.cities,
        req.query.otherCities,
        req.query.titles,
        req.query.soldOut && req.query.soldOut === 'true',
        req.query.available && req.query.available === 'true',
        req.query.screeningTypes,
        req.query.otherScreeningTypes,
        req.query.filmIds,
        req.query.categories,
        req.query.tags,
        req.query.verbosity,
      )
      res.type('text/csv')
      response.pipe(res)
    } catch (e) {
      next(e)
    }
  },
)

router.get(MainController.getScreeningPathExpress, async (req: Request<{ screeningId: string }>, res, next) => {
  const controller = new MainController()
  try {
    const response = controller.getScreening(req.params.screeningId)
    return res.send(response)
  } catch (e) {
    next(e)
  }
})

router.delete(MainController.clearCartPath, async (req, res, next) => {
  const controller = new MainController()
  try {
    await controller.clearCart()
    return res.status(MainController.clearCartStatus).send()
  } catch (e) {
    next(e)
  }
})

router.put(MainController.putRunningMainPathExpress, async (req: Request<{ value: 'true' | 'false' }>, res, next) => {
  const controller = new MainController()
  try {
    await controller.setRunningMain(req.params.value)
    return res.status(MainController.putRunningMainStatus).send()
  } catch (e) {
    next(e)
  }
})

router.get(MainController.getStatePath, async (req, res, next) => {
  const controller = new MainController()
  try {
    const response = controller.getAppState()
    return res.send(response)
  } catch (e) {
    next(e)
  }
})

export default router
