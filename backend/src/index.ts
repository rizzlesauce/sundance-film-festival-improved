import webdriver, { By, until, WebDriver, WebElement } from 'selenium-webdriver'
import { parse, parseISO } from 'date-fns'
import CsvReadableStream from 'csv-reader'
import { createObjectCsvWriter } from 'csv-writer'
import fs from 'fs'
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import JsonDb from 'simple-json-db'

console.log('welcome!')

const db = new JsonDb('storage.json')

const baseUrl = 'https://festival.sundance.org'
const homeUrl = `${baseUrl}/`
const signinUrl = `${baseUrl}/sign-in`
const ticketsUrl = `${baseUrl}/tickets`
const cartUrl = `${ticketsUrl}/cart`

function waitTime(ms: number) {
  return ms
}

function removeParenthesis(str: string) {
  let result = str
  if (str.startsWith('(') && str.endsWith(')')) {
    result = str.substring(1, str.length - 1)
  }
  return result
}

const referenceDate = new Date()

const csvFilePath = 'output.csv'

const csvHeader = [
  'id',
  'title',
  'date',
  'startDateTime',
  'endDateTime',
  'type',
  'isPremiere',
  'isSecondScreening',
  'location',
  'isInParkCity',
  'isInSaltLakeCity',
  'isSoldOut',
  'index',
]

let childNum = 1
const ScreeningInfoChildNumber = {
  Title: childNum++,
  Date: childNum++,
  TimeRangeAndScreeningType: childNum++,
  Location: childNum++,
}

type ScreeningBasicInfo = {
  id: string
  firstPart: WebElement
  title: string
  dateString: string
  timeRangeAndScreeningTypeTd: WebElement
  timeRangeString: string
  location: string
}

async function getBasicScreeningInfo(screening: WebElement): Promise<ScreeningBasicInfo> {
  const firstPart = await screening.findElement(By.css('.sd_first_select_film'))

  const title = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Title}) a`)).getText()
  const dateString = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Date})`)).getText()
  const timeRangeAndScreeningTypeTd = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.TimeRangeAndScreeningType})`))
  const timeRangeString = await timeRangeAndScreeningTypeTd.findElement(By.css(':scope > p:nth-child(1)')).getText()
  const location = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Location})`)).getText()

  const screeningId = `${title} - ${dateString} - ${timeRangeString} - ${location}`

  return {
    id: screeningId,
    firstPart,
    title,
    dateString,
    timeRangeAndScreeningTypeTd,
    timeRangeString,
    location,
  }
}

async function getScreeningInfo({
  dateString,
  timeRangeAndScreeningTypeTd,
  timeRangeString,
  location,
}: Pick<ScreeningBasicInfo, 'dateString' | 'timeRangeAndScreeningTypeTd' | 'timeRangeString' | 'location'>) {
  const screeningTypeElements = await timeRangeAndScreeningTypeTd.findElements(By.css(':scope > p:nth-child(2)'))
  const screeningType = screeningTypeElements.length ? removeParenthesis(await screeningTypeElements[0].getText()) : ''

  const isPremiere = screeningType === 'Premiere'
  const isSecondScreening = screeningType === 'Second Screening'
  const isInParkCity = location.endsWith('Park City') || location.endsWith('Sundance Mountain Resort')
  const isInSaltLakeCity = location.endsWith('Salt Lake City')

  const date = parse(dateString, 'MMMM d, yyyy', referenceDate)

  const timeStrings = timeRangeString.split(' - ')
  const timeRangeObjects = timeStrings.map(timeString => {
    const dateTimeString = `${dateString} ${timeString}`
    const dateTime = parse(dateTimeString, 'MMMM d, yyyy h:mm aa', referenceDate)
    return {
      timeString,
      dateTimeString,
      dateTime,
    }
  })
  const [startTime, endTime] = timeRangeObjects

  return {
    screeningType,
    isPremiere,
    isSecondScreening,
    isInParkCity,
    isInSaltLakeCity,
    date,
    startTime,
    endTime,
  }
}

const screeningsLocator = By.css('.sd_tr_select_film')
const checkoutButtonLocator = By.xpath('//div[@class="sd_checkout_btn"]/button[contains(text(), "Checkout")]')
const removeItemButtonLocator = By.css('button.sd_mycart_item_remove_btn')
const confirmRemoveButtonLocator = By.xpath('//button[contains(@class, "sd_form_submit_button") and text()="Yes"]')

/*
async function findScreenings({
  driver,
  title,
  startDateTime,
  location,
}: {
  driver: WebDriver
  title?: string
  startDateTime?: Date
  location?: string
}) {
  const screenings = await driver.findElements(screeningsLocator)
  if (title !== undefined) {
    //screenings.
  }

  let childNum = 1
  const title = await screening.findElement(By.css(`.sd_first_select_film > td:nth-child(${childNum}) a`)).getText()
  childNum += 1
  const dateString = await screening.findElement(By.css(`.sd_first_select_film > td:nth-child(${childNum})`)).getText()
  childNum += 1
  const timeRangeString = await screening.findElement(By.css(`.sd_first_select_film > td:nth-child(${childNum}) p:nth-child(1)`)).getText()
  const screeningTypeElements = await screening.findElements(By.css(`.sd_first_select_film > td:nth-child(${childNum}) p:nth-child(2)`))
  const screeningType = screeningTypeElements.length ? removeParenthesis(await screeningTypeElements[0].getText()) : ''
  childNum += 1
  const location = await screening.findElement(By.css(`.sd_first_select_film > td:nth-child(${childNum})`)).getText()

  const isPremiere = screeningType === 'Premiere'
  const isSecondScreening = screeningType === 'Second Screening'
  const isInParkCity = location.endsWith('Park City')
  const isInSaltLakeCity = location.endsWith('Salt Lake City')

  const date = parse(dateString, 'MMMM d, yyyy', referenceDate)

    const timeStrings = timeRangeString.split(' - ')
    const timeRangeObjects = timeStrings.map(timeString => {
      const dateTimeString = `${dateString} ${timeString}`
      const dateTime = parse(dateTimeString, 'MMMM d, yyyy h:mm aa', referenceDate)
      return {
        timeString,
        dateTimeString,
        dateTime,
      }
    })
    const [startTime, endTime] = timeRangeObjects
*/

async function loadScreenings(driver: WebDriver) {
  /*
  const lastDateInput = 'January 29, 2023'
  const lastDate = parse(lastDateInput, 'MMMM d, yyyy', referenceDate)
  const lastDateFormatted = format(lastDate, 'MMMM d, yyyy')
  */

  await driver.get(ticketsUrl)

  const selectAScreeningButtonLocator = By.xpath('//button[contains(text(), "Select a Screening")]')
  await driver.wait(until.elementLocated(selectAScreeningButtonLocator), waitTime(10000))
  await driver.findElement(selectAScreeningButtonLocator).click()

  /*
  const lastDateInput = 'January 29, 2023'
  const lastDate = parse(lastDateInput, 'MMMM d, yyyy', referenceDate)
  const lastDateFormatted = format(lastDate, 'MMMM d, yyyy')
  */

  if (search) {
    const searchInputLocator = By.css('.sd_popup_search_input input')
    await driver.wait(until.elementLocated(searchInputLocator), waitTime(5000))
    await driver.findElement(searchInputLocator).sendKeys(search)
  }

  //await driver.wait(until.elementLocated(By.xpath(`//div[@class="sd_first_select_film"]/td[text()="${lastDateFormatted}"]`)))
  try {
    await driver.wait(until.elementLocated(By.css('div.sd_first_select_film')), waitTime(10000))
  } catch (e) {
    // element not found
    console.log('no screenings found')
  }

  const screenings = await driver.findElements(screeningsLocator)

  return screenings
}

let search = ''
let sortBy: 'start' | 'end' = 'start'
let filterScreeningType: 'premiere' | 'second' | string | undefined
let filterCity: 'parkCity' | 'slc' | string | undefined
let filterLocation: string | undefined
let listAll = true
let selectFilm = true
let listSorted = true
let skipTba = true

type ParsedScreening = {
  title: string
  startDateTime: Date
  endDateTime: Date
  screeningType: string
  isPremiere: boolean
  isSecondScreening: boolean
  location: string
  isInParkCity: boolean
  isInSaltLakeCity: boolean
  id: string
  index: number
  isSoldOut?: boolean
}

type BoolString = 'true' | 'false'

type ParsedScreeningCsv = {
  title: string
  date: string
  startDateTime: string
  endDateTime: string
  screeningType: string
  isPremiere: BoolString
  isSecondScreening: BoolString
  location: string
  isInParkCity: BoolString
  isInSaltLakeCity: BoolString
  id: string
  index?: string
  isSoldOut: BoolString | ''
}

async function run() {
  const parsedScreeningsFileExisted = fs.existsSync(csvFilePath)
  const parsedScreenings: ParsedScreening[] = parsedScreeningsFileExisted ? (
    await new Promise<ParsedScreeningCsv[]>((resolve, reject) => {
      const result: ParsedScreeningCsv[] = []
      const inputStream = fs.createReadStream(csvFilePath, 'utf8')
      inputStream.pipe(new CsvReadableStream())
        .on('data', row => {
          if (!Array.isArray(row)) {
            throw new Error('expected array')
          }
          const obj: any = {}
          csvHeader.forEach((propertyName, i) => {
            obj[propertyName] = row[i]
          })
          result.push(obj as ParsedScreeningCsv)
        })
        .on('end', () => {
          resolve(result)
        })
        .on('error', err => {
          reject(err)
        })
    })
  ).map(datum => ({
    ...datum,
    date: parseISO(datum.date),
    startDateTime: parseISO(datum.startDateTime),
    endDateTime: parseISO(datum.endDateTime),
    isPremiere: datum.isPremiere === 'true',
    isSecondScreening: datum.isSecondScreening === 'true',
    isInParkCity: datum.isInParkCity === 'true',
    isInSaltLakeCity: datum.isInSaltLakeCity === 'true',
    index: (datum.index && +datum.index) || 0,
    isSoldOut: datum.isSoldOut === '' ? undefined : datum.isSoldOut === 'true',
  })) : []

  if (parsedScreenings.length) {
    console.log('parsedScreenings')
    parsedScreenings.forEach(screening => console.log(screening))
  }
  let stop = false
  if (stop) {
    return
  }

  const csvWriter = createObjectCsvWriter({
    path: csvFilePath,
    header: csvHeader.map(name => ({ id: name, title: name })),
    append: parsedScreeningsFileExisted,
  })

  const email = process.env['SUNDANCE_EMAIL']
  if (!email) {
    throw new Error('missing SUNDANCE_EMAIL')
  }

  const password = process.env['SUNDANCE_PASSWORD']
  if (!password) {
    throw new Error('missing SUNDANCE_PASSWORD')
  }

  const driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build()

  await driver.get(signinUrl)

  const emailInputLocator = By.css('input[name="email"]')
  await driver.wait(until.elementLocated(emailInputLocator), waitTime(5000))
  await driver.findElement(emailInputLocator).sendKeys(email)

  const passwordInputLocator = By.css('input[name="password"]')
  await driver.wait(until.elementLocated(passwordInputLocator), waitTime(5000))
  await driver.findElement(By.css('input[name="password"]')).sendKeys(password)

  const signinSubmitButtonLocator = By.css('.sd_form_submit button')
  await driver.wait(until.elementLocated(signinSubmitButtonLocator), waitTime(5000))
  await driver.findElement(signinSubmitButtonLocator).click()

  await driver.wait(until.urlIs(homeUrl), waitTime(10000))

  // remove cart items if exist
  await driver.get(cartUrl)

  let hasRemoveButtons = false
  try {
    await driver.wait(until.elementLocated(checkoutButtonLocator), waitTime(7000))
    hasRemoveButtons = true
  } catch (e) {
    hasRemoveButtons = false
  }

  while (hasRemoveButtons) {
    try {
      await driver.wait(until.elementLocated(removeItemButtonLocator), waitTime(3000))
      hasRemoveButtons = true
    } catch (e) {
      // TODO: check error type
      hasRemoveButtons = false
    }
    if (hasRemoveButtons) {
      const removeButtons = await driver.findElements(removeItemButtonLocator)
      if (removeButtons.length) {
        await removeButtons[0].click()

        await driver.wait(until.elementLocated(confirmRemoveButtonLocator), waitTime(5000))
        await driver.findElement(confirmRemoveButtonLocator).click()
        await new Promise(resolve => setTimeout(resolve, waitTime(1000)))
      }
    }
  }

  let screenings = await loadScreenings(driver)
  const previousLastParsedScreening = parsedScreenings.length ? parsedScreenings[parsedScreenings.length - 1] : undefined
  let screeningIndex = previousLastParsedScreening?.index ?? -1
  console.log('last parsed screeningIndex', screeningIndex)
  if (!previousLastParsedScreening || (screeningIndex >= screenings.length) || (screeningIndex < 0)) {
    screeningIndex = 0
    console.log('screeningIndex out of range')
  } else {
    const basicInfo = await getBasicScreeningInfo(screenings[screeningIndex])

    if (basicInfo.id !== previousLastParsedScreening.id) {
      console.log('screening id does not match expected', basicInfo, previousLastParsedScreening)
      screeningIndex = 0
    } else {
      screeningIndex += 1
    }
  }

  for (; screeningIndex < screenings.length; ++screeningIndex) {
    const screening = screenings[screeningIndex]

    const basicInfo = await getBasicScreeningInfo(screening)
    const {
      id,
      title,
      dateString,
      timeRangeString,
      location,
    } = basicInfo

    console.log(`${screeningIndex}. ${id}`)

    if (skipTba && basicInfo.title.startsWith('TBA ')) {
      continue
    }

    if (parsedScreenings.find(screening => screening.id === id)) {
      continue
    }

    const moreInfo = await getScreeningInfo(basicInfo)
    const {
      screeningType,
      isPremiere,
      isSecondScreening,
      isInParkCity,
      isInSaltLakeCity,
      date,
      startTime,
      endTime,
    } = moreInfo

    if (listAll) {
      console.log('Title:', title)
      console.log('Date:', dateString, date.toLocaleString())
      console.log('Time:', timeRangeString)
      console.log('Type:', screeningType)
      console.log('Premiere:', isPremiere ? 'Yes' : 'No')
      console.log('Second Screening:', isSecondScreening ? 'Yes' : 'No')
      console.log('Location:', location)
      console.log('Is in Park City:', isInParkCity ? 'Yes' : 'No')
      console.log('Is in Salt Lake City:', isInSaltLakeCity ? 'Yes' : 'No')
      console.log('Time start:', startTime.timeString, startTime.dateTime.toLocaleString())
      console.log('Time end:', endTime.timeString, endTime.dateTime.toLocaleString())
    }

    if (filterScreeningType) {
      if (filterScreeningType === 'premiere') {
        if (!isPremiere) {
          continue
        }
      } else if (filterScreeningType === 'second') {
        if (!isSecondScreening) {
          continue
        }
      } else if (filterScreeningType !== screeningType) {
        continue
      }
    }

    if (filterCity) {
      if (filterCity === 'parkCity') {
        if (!isInParkCity) {
          continue
        }
      } else if (filterCity === 'slc') {
        if (!isInSaltLakeCity) {
          continue
        }
      } else if (!location.endsWith(filterCity)) {
        continue
      }
    }

    if (filterLocation) {
      if (!location.includes(filterLocation)) {
        continue
      }
    }

    parsedScreenings.push({
      id,
      title,
      startDateTime: startTime.dateTime,
      endDateTime: endTime.dateTime,
      screeningType,
      isPremiere,
      isSecondScreening,
      location,
      isInParkCity,
      isInSaltLakeCity,
      index: screeningIndex,
    })

    if (selectFilm) {
      const selectFilmButton = await screening.findElement(By.xpath('.//button[contains(text(), "Select Film")]'))
      await selectFilmButton.click()
      await driver.wait(until.stalenessOf(screening), waitTime(5000))

      const titleLocator = By.xpath(`//div[@class="Eventive--OrderQuantitySelect"]//div[contains(text(), "${title}")]`)
      const maxAttempts = 20
      for (let attempt = 0; attempt < maxAttempts; ++attempt) {
        try {
          await driver.get(cartUrl)

          await driver.wait(until.elementLocated(checkoutButtonLocator), waitTime(7000))
          await driver.findElement(checkoutButtonLocator).click()

          await driver.wait(until.elementLocated(titleLocator), waitTime(7000))
          break
        } catch (e) {
          console.error(e)
          console.log(`attempt ${attempt + 1} of ${maxAttempts} failed`)
          await driver.get(homeUrl)
        }
      }

      const titleElement = await driver.findElement(titleLocator)

      //const ticketTypeLocator = By.xpath(`${titleLocator}/following-sibling::div[1]`)
      const ticketTypeLocator = By.xpath(`../div[2]`)

      const ticketTypeElements = await titleElement.findElements(ticketTypeLocator)
      const ticketType = ticketTypeElements.length ? await ticketTypeElements[0].getText() : ''
      console.log('ticketType', ticketType)
      const isTicketSoldOut = ticketType.endsWith('(SOLD OUT)') || undefined
      parsedScreenings[parsedScreenings.length - 1].isSoldOut = isTicketSoldOut
      if (isTicketSoldOut) {
        console.log('SOLD OUT')
      }

      await csvWriter.writeRecords([
        {
          id,
          title,
          date: date.toISOString(),
          startDateTime: startTime.dateTime.toISOString(),
          endDateTime: endTime.dateTime.toISOString(),
          type: screeningType,
          isPremiere,
          isSecondScreening,
          location,
          isInParkCity,
          isInSaltLakeCity,
          isSoldOut: isTicketSoldOut || '',
          index: screeningIndex,
        },
      ])

      const cancelButtonLocator = By.xpath('//button/div/span[text()="Cancel"]')
      await driver.wait(until.elementLocated(cancelButtonLocator), waitTime(3000))
      const cancelButton = await driver.findElement(cancelButtonLocator)
      await cancelButton.click()
      await driver.wait(until.stalenessOf(cancelButton), waitTime(5000))

      await driver.wait(until.elementLocated(removeItemButtonLocator), waitTime(3000))
      await driver.findElement(removeItemButtonLocator).click()

      await driver.wait(until.elementLocated(confirmRemoveButtonLocator), waitTime(5000))
      await driver.findElement(confirmRemoveButtonLocator).click()

      screenings = await loadScreenings(driver)
      if (screeningIndex >= screenings.length) {
        break
      }
      const basicInfo = await getBasicScreeningInfo(screenings[screeningIndex])

      if (basicInfo.id !== id) {
        screeningIndex = -1
      }
    }
  }

  const sortedScreenings = [...parsedScreenings].sort((a, b) => {
    if (sortBy === 'start') {
      return a.startDateTime.getTime() - b.startDateTime.getTime()
    }

    if (sortBy === 'end') {
      return a.endDateTime.getTime() - b.endDateTime.getTime()
    }

    return 0
  })

  if (listSorted) {
    for (const screening of sortedScreenings) {
      console.log('Title:', screening.title)
      console.log('Type:', screening.screeningType)
      console.log('Premiere:', screening.isPremiere ? 'Yes' : 'No')
      console.log('Second Screening:', screening.isSecondScreening ? 'Yes' : 'No')
      console.log('Location:', screening.location)
      console.log('Is in Park City:', screening.isInParkCity ? 'Yes' : 'No')
      console.log('Is in Salt Lake City:', screening.isInSaltLakeCity ? 'Yes' : 'No')
      console.log('Time start:', screening.startDateTime.toLocaleString())
      console.log('Time end:', screening.endDateTime.toLocaleString())
      console.log('Sold out:', screening.isSoldOut ? 'Yes' : 'No')
    }
  }
}

if (true) {
  run()
} else {
  const app = express()
  const port = 3000

  app.use(cors())

  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json())

  app.get('/', (req, res) => {
    res.send('Welcome!')
  })

  app.post('/update-program', (req, res) => {

  })

  app.listen(port, () => console.log(`Listening on port ${port}`))
}
