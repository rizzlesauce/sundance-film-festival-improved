import { WebDriver, WebElement } from 'selenium-webdriver'
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import morgan from 'morgan'
import { DateTime } from 'luxon'
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
  selectFilmToGetInfo,
} from './shared/shared'
import Router from './routes'
import db from './shared/db'
import { usingGmail, usingTwitter } from './shared/notifications'

console.log('welcome!')
console.log('Is using Gmail notification:', usingGmail)
console.log('Is using Twitter notification:', usingTwitter)

async function run() {
  let screeningsSeen = db.scannedScreenings
  if (db.currentScreeningId !== undefined) {
    state.screeningIndex = db.program.indexOf(db.currentScreeningId)
  }
  if (state.screeningIndex === -1) {
    state.screeningIndex = 0
  }
  let driver: WebDriver | undefined
  while (true) {
    let screenings: WebElement[] | undefined
    try {
      if (!state.runningMain || state.inOp) {
        screenings = undefined
        continue
      }
      driver = await createWebDriver()
      assertNotInOp()
      try {
        await startOp()
        if (selectFilmToGetInfo) {
          await signIn(driver)
        }
        if (state.inOp > 1) {
          throw new Error('stopping main to allow pending op')
        }
        if (selectFilmToGetInfo) {
          await clearCart(driver)
        }
        if (state.inOp > 1) {
          throw new Error('stopping main to allow pending op')
        }
      } finally {
        endOp()
      }
      while (state.runningMain && !state.inOp) {
        if (!db.program.length || state.screeningIndex >= db.program.length) {
          state.screeningIndex = 0
          screeningsSeen = new Set()
          db.scannedScreenings = screeningsSeen
          db.currentScreeningId = undefined
          screenings = undefined
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
        const screeningId = db.program[state.screeningIndex]
        if (!screeningsSeen.has(screeningId)) {
          let result
          try {
            assertNotInOp()
            startOp()
            result = await refreshScreeningInfo({ driver, screeningId, screenings })
            if (!selectFilmToGetInfo) {
              screenings = result.screenings
            }
          } finally {
            endOp()
          }
          screeningsSeen.add(screeningId)
          db.scannedScreenings = screeningsSeen
          state.screeningIndex = result.screeningIndex
        }
        ++state.screeningIndex
        db.currentScreeningId = db.program[state.screeningIndex]
      }
    } catch (error) {
      console.error(error)
    } finally {
      screenings = undefined
      if (driver) {
        driver.close()
        driver = undefined
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

const app = express()

if (false) {
  app.use(cors())
}

function customReplacer(this: any, key: string, value: any): any {
  if (this[key] instanceof Date) {
     return DateTime.fromJSDate(this[key]).setZone('local').toFormat('ccc, f ZZZZ')
  }
  return value
}

app.use(
  '/swagger-ui',
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

app.set('json replacer', customReplacer)

app.get('/', (req, res) => {
  console.log('GET /')
  res.send('Welcome!')
})

app.use(Router)

app.listen(port, () => console.log('Listening on port', port))

run()
