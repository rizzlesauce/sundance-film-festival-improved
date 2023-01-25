import express, { Request } from 'express'
import { BoolString, GetScreeningsFilterCity, GetScreeningsFilterPremiereType as GetScreeningsFilterScreeningType, GetScreeningsSortBy } from 'src/shared/shared'
import MainController from '../controllers/MainController'

const router = express.Router()

router.post(MainController.refreshProgramPath, async (req, res) => {
  const controller = new MainController()
  const response = await controller.refreshProgram()
  return res.send(response)
})

router.get(MainController.getProgramPath, async (req, res) => {
  const controller = new MainController()
  const response = await controller.getProgram()
  return res.send(response)
})

router.post(MainController.refreshScreeningInfoPathExpress, async (req: Request<{ screeningId: string }>, res) => {
  const controller = new MainController()
  const response = await controller.refreshScreeningInfo(req.params.screeningId)
  return res.send(response)
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
  ) => {
    console.log('params', req.params)
    const controller = new MainController()
    const response = await controller.purchaseScreeningTickets(
      req.params.screeningId,
      +req.query.quantity,
    )
    return res.send(response)
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
        cities?: GetScreeningsFilterCity[]
        titles?: string[]
        soldOut?: BoolString
        available?: BoolString
        screeningType?: GetScreeningsFilterScreeningType
      }
    >,
    res,
  ) => {
    const controller = new MainController()
    const response = controller.getScreenings(
      req.query.sortBy,
      req.query.cities,
      req.query.titles,
      req.query.soldOut !== undefined ? req.query.soldOut === 'true' : undefined,
      req.query.available !== undefined ? req.query.available === 'true' : undefined,
      req.query.screeningType,
    )
    return res.send(response)
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
        cities?: GetScreeningsFilterCity[]
        titles?: string[]
        soldOut?: BoolString
        available?: BoolString
        screeningType?: GetScreeningsFilterScreeningType
      }
    >,
    res,
  ) => {
    const controller = new MainController()
    const response = controller.getScreeningsCsv(
      req.query.sortBy,
      req.query.cities,
      req.query.titles,
      req.query.soldOut !== undefined ? req.query.soldOut === 'true' : undefined,
      req.query.available !== undefined ? req.query.available === 'true' : undefined,
      req.query.screeningType,
    )
    res.type('text/csv')
    response.pipe(res)
  },
)

router.get(MainController.getScreeningPathExpress, async (req: Request<{ screeningId: string }>, res) => {
  const controller = new MainController()
  const response = controller.getScreening(req.params.screeningId)
  return res.send(response)
})

router.delete(MainController.clearCartPath, async (req, res) => {
  const controller = new MainController()
  await controller.clearCart()
  return res.status(MainController.clearCartStatus).send()
})

router.put(MainController.putRunningMainPathExpress, async (req: Request<{ value: 'true' | 'false' }>, res) => {
  const controller = new MainController()
  await controller.setRunningMain(req.params.value)
  return res.status(MainController.putRunningMainStatus).send()
})

router.get(MainController.getStatePath, async (req, res) => {
  const controller = new MainController()
  const response = controller.getAppState()
  return res.send(response)
})

export default router
