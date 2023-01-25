import { WebDriver } from 'selenium-webdriver'
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import morgan from 'morgan'
import {
  createWebDriver,
  signIn,
  clearCart,
  port,
  refreshProgram,
  refreshScreeningInfo,
  endOp,
  startOp,
  state,
  assertNotInOp,
} from './shared/shared'
import Router from './routes'
import db from './shared/db'

console.log('welcome!')

async function run() {
  let screeningsSeen = db.scannedScreenings
  let screeningIndex = -1
  if (db.currentScreeningId !== undefined) {
    screeningIndex = db.program.indexOf(db.currentScreeningId)
  }
  if (screeningIndex === -1) {
    screeningIndex = 0
  }
  let driver: WebDriver | undefined
  while (true) {
    try {
      if (!state.runningMain || state.inOp) {
        continue
      }
      driver = await createWebDriver()
      assertNotInOp()
      try {
        await startOp()
        await signIn(driver)
        if (state.inOp > 1) {
          throw new Error('stopping main to allow pending op')
        }
        await clearCart(driver)
        if (state.inOp > 1) {
          throw new Error('stopping main to allow pending op')
        }
      } finally {
        endOp()
      }
      while (state.runningMain && !state.inOp) {
        if (!db.program.length || screeningIndex >= db.program.length) {
          screeningIndex = 0
          screeningsSeen = []
          db.scannedScreenings = screeningsSeen
          db.currentScreeningId = undefined
          assertNotInOp()
          try {
            await startOp()
            await refreshProgram(driver)
          } finally {
            endOp()
          }
          console.log('reached end of program')
          break
        }
        const screeningId = db.program[screeningIndex]
        if (!screeningsSeen.includes(screeningId)) {
          let result
          try {
            assertNotInOp()
            startOp()
            result = await refreshScreeningInfo({ driver, screeningId })
          } finally {
            endOp()
          }
          screeningsSeen.push(screeningId)
          db.scannedScreenings = screeningsSeen
          screeningIndex = result.screeningIndex
        }
        ++screeningIndex
        db.currentScreeningId = db.program[screeningIndex]
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (driver) {
        driver.close()
        driver = undefined
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

if (false) {
  run()
} else {
  const app = express()

  if (false) {
    app.use(cors())
  }

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: {
        url: '/swagger.json',
      },
      explorer: true,
    }),
  )

  app.use(morgan('tiny'))
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())
  app.use(express.static('public'))

  app.get('/', (req, res) => {
    console.log('GET /')
    res.send('Welcome!')
  })

  app.use(Router)

  app.listen(port, () => console.log('Listening on port', port))

  run()
}
