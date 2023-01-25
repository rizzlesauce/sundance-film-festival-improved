import webdriver, { By, until, WebDriver, WebElement } from 'selenium-webdriver'
import { parse, addDays } from 'date-fns'
import { createObjectCsvWriter } from 'csv-writer'
import db, { Db, ScreeningBasicInfo, ScreeningMoreInfo } from './db'

let ops: (() => void)[] = []

export const state = {
  inOp: 0,
  runningMain: true,
}

export function assertNotInOp() {
  if (state.inOp) {
    throw new Error('is already in op!')
  }
}

export async function startOp() {
  //assertNotInOp()
  const { inOp } = state
  if (inOp > 0) {
    await new Promise<void>(resolve => {
      state.inOp += 1
      ops.push(resolve)
    })
  } else {
    state.inOp += 1
  }
}

export function endOp() {
  state.inOp -= 1
  const handleEnd = ops.shift()
  if (handleEnd) {
    handleEnd()
  }
}

export const email = process.env['SUNDANCE_EMAIL'] || ''
if (!email) {
  throw new Error('missing SUNDANCE_EMAIL')
}

export const password = process.env['SUNDANCE_PASSWORD'] || ''
if (!password) {
  throw new Error('missing SUNDANCE_PASSWORD')
}

export const port = +(process.env.PORT || 3000)

export const baseUrl = 'https://festival.sundance.org'
export const homeUrl = `${baseUrl}/`
export const signinUrl = `${baseUrl}/sign-in`
export const ticketsUrl = `${baseUrl}/tickets`
export const cartUrl = `${ticketsUrl}/cart`

export function waitTime(ms: number) {
  return ms
}

export function removeParenthesis(str: string) {
  let result = str
  if (str.startsWith('(') && str.endsWith(')')) {
    result = str.substring(1, str.length - 1)
  }
  return result
}

export const referenceDate = new Date()

export const csvFilePath = 'output.csv'

export const csvHeader = [
  'id',
  'title',
  'startTime',
  'endTime',
  'screeningType',
  'isPremiere',
  'isSecondScreening',
  'location',
  'isInParkCity',
  'isInSaltLakeCity',
  'isSoldOut',
  'ticketsPurchased',
  'ticketsRemaining',
  'isUnavailable',
  'updatedAt',
  'index',
]

let childNum = 1
export const ScreeningInfoChildNumber = {
  Title: childNum++,
  Date: childNum++,
  TimeRangeAndScreeningType: childNum++,
  Location: childNum++,
}

export type ScreeningBasicInfoExtended = ScreeningBasicInfo & {
  id: string
  firstPart: WebElement
  timeRangeAndScreeningTypeTd: WebElement
}

export async function getBasicScreeningInfo(screening: WebElement): Promise<ScreeningBasicInfoExtended> {
  const updatedAt = new Date()
  const firstPart = await screening.findElement(By.css('.sd_first_select_film'))

  const title = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Title}) a`)).getText()
  const dateString = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Date})`)).getText()
  const timeRangeAndScreeningTypeTd = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.TimeRangeAndScreeningType})`))
  const timeRangeString = await timeRangeAndScreeningTypeTd.findElement(By.css(':scope > p:nth-child(1)')).getText()
  const location = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Location})`)).getText()
  const isInParkCity = location.endsWith('Park City') || location.endsWith('Sundance Mountain Resort')
  const isInSaltLakeCity = location.endsWith('Salt Lake City')

  const screeningId = `${title} - ${dateString} - ${timeRangeString} - ${location}`

  const timeStrings = timeRangeString.split(' - ')
  const timeRangeObjects = timeStrings.map(timeString => {
    const dateTimeString = `${dateString} ${timeString}`
    let dateTime = parse(dateTimeString, 'MMMM d, yyyy h:mm aa', referenceDate)
    return {
      timeString,
      dateTime,
    }
  })
  const [startTime, endTime] = timeRangeObjects
  if (endTime.dateTime < startTime.dateTime) {
    endTime.dateTime = addDays(endTime.dateTime, 1)
  }

  return {
    id: screeningId,
    firstPart,
    title,
    dateString,
    timeRangeAndScreeningTypeTd,
    timeRangeString,
    location,
    isInParkCity,
    isInSaltLakeCity,
    startTime: startTime.dateTime,
    endTime: endTime.dateTime,
    updatedAt,
  }
}

export async function getScreeningInfo({
  timeRangeAndScreeningTypeTd,
}: Pick<ScreeningBasicInfoExtended, 'timeRangeAndScreeningTypeTd'>) : Promise<ScreeningMoreInfo> {
  const updatedAt = new Date()
  const screeningTypeElements = await timeRangeAndScreeningTypeTd.findElements(By.css(':scope > p:nth-child(2)'))
  const screeningType = screeningTypeElements.length ? removeParenthesis(await screeningTypeElements[0].getText()) : ''

  const isPremiere = screeningType === 'Premiere'
  const isSecondScreening = screeningType === 'Second Screening'

  return {
    screeningType,
    isPremiere,
    isSecondScreening,
    updatedAt,
  }
}

export const screeningsLocator = By.css('.sd_tr_select_film')
export const checkoutButtonLocator = By.xpath('//div[@class="sd_checkout_btn"]/button[contains(text(), "Checkout")]')
export const removeItemButtonLocator = By.css('button.sd_mycart_item_remove_btn')
export const confirmRemoveButtonLocator = By.xpath('//button[contains(@class, "sd_form_submit_button") and text()="Yes"]')

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

export async function loadScreenings(driver: WebDriver) {
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

export let search = ''
export let sortBy: 'start' | 'end' = 'start'
export let filterScreeningType: 'premiere' | 'second' | string | undefined
export let filterCity: 'parkCity' | 'slc' | string | undefined
export let filterLocation: string | undefined
export let listAll = true
export let selectFilm = true
export let listSorted = true
export let skipTba = true

export async function createWebDriver() {
  const driver = await new webdriver.Builder()
    .forBrowser('chrome')
    .build()
  return driver
}

export async function signIn(driver: WebDriver) {
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
}

export async function clearCart(driver: WebDriver) {
  // remove cart items if exist
  await driver.get(cartUrl)

  const emptyCartLocator = By.css('.sd_mycart_item_not_found')
  let isNotEmpty = true
  const findOutIfHasEmptyCart = async () => {
    // TODO: wait in a more efficient way
    await new Promise(resolve => setTimeout(resolve, waitTime(1000)))

    await driver.wait(async () => {
      const checkoutButtons = await driver.findElements(checkoutButtonLocator)
      if (checkoutButtons.length) {
        console.log('cart has items in it')
        isNotEmpty = true
        return true
      }
      const emptyCartTexts = await driver.findElements(emptyCartLocator)
      if (emptyCartTexts.length) {
        isNotEmpty = false
        return true
      }
    }, waitTime(7000))
  }

  while (isNotEmpty) {
    await findOutIfHasEmptyCart()
    if (isNotEmpty) {
      await driver.wait(until.elementLocated(removeItemButtonLocator), waitTime(3000))
      const removeButtons = await driver.findElements(removeItemButtonLocator)
      if (removeButtons.length) {
        const removeButton = removeButtons[0]
        await removeButton.click()

        await driver.wait(until.elementLocated(confirmRemoveButtonLocator), waitTime(5000))
        const confirmButton = await driver.findElement(confirmRemoveButtonLocator)
        await confirmButton.click()

        await driver.wait(until.stalenessOf(confirmButton), waitTime(5000))
        await driver.wait(until.stalenessOf(removeButton), waitTime(5000))
      }
    }
  }
  console.log('cart is empty')
}

export async function refreshProgram(driver: WebDriver, screenings?: WebElement[]) {
  console.log('refreshProgram()')
  const screeningsActual = screenings ?? await loadScreenings(driver)
  const basicInfos: ScreeningBasicInfoExtended[] = []

  for (const screening of screeningsActual) {
    const basicInfo = await getBasicScreeningInfo(screening)
    basicInfos.push(basicInfo)
    const {
      id,
      firstPart,
      timeRangeAndScreeningTypeTd,
      ...rest
    } = basicInfo
    db.setScreeningBasicInfo(basicInfo.id, rest)
  }

  const program = basicInfos.map(({ id }) => id)
  db.program = program
  return program
}

export type BoolString = 'true' | 'false'

export async function refreshScreeningInfo({
  driver,
  screeningId,
  purchaseTicketCount,
}: {
  driver: WebDriver
  screeningId: string
  purchaseTicketCount?: number
}) {
  let { program } = db
  let refreshedProgram = false
  if (false && program.length) {
    console.log('program')
    program.forEach(screeningId => console.log(screeningId))
  }

  let screeningIndex = program.indexOf(screeningId)
  let info: ReturnType<typeof getScreeningInfoStored> | undefined

  let screenings = await loadScreenings(driver)
  let basicInfo: ScreeningBasicInfoExtended | undefined
  console.log('screeningIndex', screeningIndex)
  if (screeningIndex >= screenings.length || screeningIndex < 0) {
    screeningIndex = -1
    console.log('screeningIndex out of range')
  } else {
    basicInfo = await getBasicScreeningInfo(screenings[screeningIndex])

    if (basicInfo.id !== screeningId) {
      console.log('screening id does not match expected', basicInfo, screeningId)
      screeningIndex = -1
      basicInfo = undefined
    }
  }

  if (screeningIndex === -1) {
    program = await refreshProgram(driver, screenings)
    refreshedProgram = true
    screeningIndex = program.indexOf(screeningId)
    if (screeningIndex === -1) {
      console.log(`screening no longer available: ${screeningId}`)
      const storedBasicInfo = db.getScreeningBasicInfo(screeningId)
      if (storedBasicInfo) {
        db.setScreeningBasicInfo(screeningId, {
          ...storedBasicInfo,
          isUnavailable: true,
        })
      }
      return {
        screeningIndex,
        refreshedProgram,
        info,
      }
    }
  }

  const screening = screenings[screeningIndex]
  if (!basicInfo) {
    basicInfo = await getBasicScreeningInfo(screening)

    if (basicInfo.id !== screeningId) {
      console.log('screening id does not match expected', basicInfo, screeningId)
      screeningIndex = -1
      basicInfo = undefined
      return {
        screeningIndex,
        refreshedProgram,
        info,
      }
    }
  }

  const {
    id,
    title,
    dateString,
    timeRangeString,
    location,
    isInParkCity,
    isInSaltLakeCity,
    startTime,
    endTime,
    updatedAt,
  } = basicInfo

  console.log(`${screeningIndex}. ${id}`)

  db.setScreeningBasicInfo(screeningId, {
    title,
    dateString,
    timeRangeString,
    location,
    isInParkCity,
    isInSaltLakeCity,
    startTime,
    endTime,
    isUnavailable: false,
    updatedAt,
  })

  const moreInfo = await getScreeningInfo(basicInfo)
  const {
    screeningType,
    isPremiere,
    isSecondScreening,
    updatedAt: moreInfoUpdatedAt,
  } = moreInfo

  if (listAll) {
    console.log('Title:', title)
    console.log('Date:', dateString)
    console.log('Time:', timeRangeString)
    console.log('Type:', screeningType)
    console.log('Premiere:', isPremiere ? 'Yes' : 'No')
    console.log('Second Screening:', isSecondScreening ? 'Yes' : 'No')
    console.log('Location:', location)
    console.log('Is in Park City:', isInParkCity ? 'Yes' : 'No')
    console.log('Is in Salt Lake City:', isInSaltLakeCity ? 'Yes' : 'No')
    console.log('Time start:', startTime.toLocaleString())
    console.log('Time end:', endTime.toLocaleString())
  }

  const newMoreInfo = {
    screeningType,
    isPremiere,
    isSecondScreening,
    updatedAt: moreInfoUpdatedAt,
  }

  db.setScreeningMoreInfo(screeningId, newMoreInfo)

  if (skipTba && basicInfo.title.startsWith('TBA ')) {
    // do nothing
  } else if (selectFilm) {
    const selectFilmButton = await screening.findElement(By.xpath('.//button[contains(text(), "Select Film")]'))
    await selectFilmButton.click()
    await driver.wait(until.stalenessOf(screening), waitTime(5000))

    const titleLocator = By.xpath(`//div[@class="Eventive--OrderQuantitySelect"]//div[contains(text(), "${title}")]`)
    const maxAttempts = 20
    for (let attempt = 0; attempt < maxAttempts; ++attempt) {
      try {
        await driver.get(cartUrl)

        await driver.wait(until.elementLocated(checkoutButtonLocator), waitTime(7000))

        if (purchaseTicketCount !== undefined) {
          // TODO: remove
          console.log('purchaseTicketCount', typeof purchaseTicketCount, purchaseTicketCount)
          const getCurrentTicketCount = async () => {
            return +(await driver.findElement(By.css('div.sd_home_pass_count > input')).getAttribute('value'))
          }

          let currentTicketCount: number | undefined
          while (currentTicketCount === undefined || currentTicketCount !== purchaseTicketCount) {
            currentTicketCount = await getCurrentTicketCount()
            console.log('currentTicketCount', currentTicketCount)
            if (currentTicketCount < purchaseTicketCount) {
              const ticketCount = currentTicketCount
              await driver.findElement(By.css('button.sd_home_pc_increase')).click()
              await driver.wait(async () => {
                currentTicketCount = await getCurrentTicketCount()
                return currentTicketCount === (ticketCount + 1)
              })
            } else if (currentTicketCount > purchaseTicketCount) {
              throw new Error('Ticket count higher than requested!')
            }
          }
          console.log('currentTicketCount', currentTicketCount)
        }

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
    const ticketType = ticketTypeElements.length ? await ticketTypeElements[0].getText() : undefined
    console.log('ticketType', ticketType)
    const isTicketSoldOut = (ticketType || '').endsWith('(SOLD OUT)') || undefined
    if (isTicketSoldOut) {
      console.log('SOLD OUT')
    }

    const storedMoreInfo = db.getScreeningMoreInfo(screeningId)
    const newestMoreInfo = {
      ...storedMoreInfo || newMoreInfo,
      ticketType,
      isSoldOut: isTicketSoldOut,
    }
    db.setScreeningMoreInfo(screeningId, newestMoreInfo)

    let purchased = false
    if (purchaseTicketCount !== undefined) {
      const term1Locator = By.xpath('//input[@type="checkbox" and @name="sundanceTerm1"]')
      await driver.wait(until.elementLocated(term1Locator))
      await driver.findElement(term1Locator).click()

      const term2Locator = By.xpath('//input[@type="checkbox" and @name="sundanceTerm2"]')
      await driver.wait(until.elementLocated(term2Locator))
      await driver.findElement(term2Locator).click()

      // TODO: remove
      //await new Promise(resolve => setTimeout(resolve, 10 * 60000))

      const buyMiniPrefix = 'Buy ($'
      const buyPrefix = `${buyMiniPrefix}`
      const buyPostfix = ')'
      const buyButtonLocator = By.xpath(`//button//span[contains(text(), "${buyMiniPrefix}")]`)
      await driver.wait(until.elementLocated(buyButtonLocator), waitTime(3000))
      const buyButton = await driver.findElement(buyButtonLocator)
      const buyText = await buyButton.getText()
      const dollars = +buyText.substring(buyPrefix.length, buyText.length - buyPostfix.length)
      console.log('total:', `$${dollars}`)
      if (dollars > purchaseTicketCount * (25 + 2)) {
        throw new Error(`Unexpected higher price: $${dollars}`)
      }

      await buyButton.click()

      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check for error message
      //Sorry, there aren't enough tickets left to fulfill this order ("Landscape With Invisible Hand" Single Film Ticket tickets remaining: 0).
      const buyErrorLocator = By.xpath(String.raw`//div[contains(text(), "enough tickets left to fulfill this order")]`)
      let errorNode: WebElement | undefined
      await driver.wait(async () => {
        const buyButtons = await driver.findElements(buyButtonLocator)
        if (!buyButtons.length) {
          errorNode = undefined
          return true
        }
        const errorNodes = await driver.findElements(buyErrorLocator)
        if (errorNodes.length) {
          errorNode = errorNodes[0]
          return true
        }
      }, waitTime(5000))

      if (errorNode) {
        const errorMessage = await errorNode.getText()
        console.error(errorMessage)
        const ticketsRemainingMatch = errorMessage.match(/ tickets remaining: (\d+)/)
        console.log('ticketsRemainingMatch', ticketsRemainingMatch)
        const numberRemainingString = ticketsRemainingMatch?.[1]
        if (numberRemainingString) {
          const numberRemaining = +numberRemainingString
          console.log(`remaining tickets: ${numberRemaining}`)
          const storedMoreInfo = db.getScreeningMoreInfo(screeningId)
          db.setScreeningMoreInfo(screeningId, {
            ...storedMoreInfo || newestMoreInfo,
            isSoldOut: numberRemaining === 0,
            ticketsRemaining: numberRemaining || undefined,
          })
        }
      }

      if (purchased) {
        const storedMoreInfo = db.getScreeningMoreInfo(screeningId)
        db.setScreeningMoreInfo(screeningId, {
          ...storedMoreInfo || newestMoreInfo,
          ticketsPurchased: (storedMoreInfo?.ticketsPurchased ?? 0) + purchaseTicketCount,
        })
      }
    }

    if (!purchased) {
      const cancelButtonLocator = By.xpath('//button//span[text()="Cancel"]')
      await driver.wait(until.elementLocated(cancelButtonLocator), waitTime(3000))
      const cancelButton = await driver.findElement(cancelButtonLocator)
      await cancelButton.click()
      await driver.wait(until.stalenessOf(cancelButton), waitTime(5000))

      await driver.wait(until.elementLocated(removeItemButtonLocator), waitTime(3000))
      await driver.findElement(removeItemButtonLocator).click()

      await driver.wait(until.elementLocated(confirmRemoveButtonLocator), waitTime(5000))
      await driver.findElement(confirmRemoveButtonLocator).click()
    }
  }

  info = getScreeningInfoStored(screeningId)

  return {
    screeningIndex,
    refreshedProgram,
    info,
  }
}

export function getScreeningInfoStored(screeningId: string) {
  const basicInfo = db.getScreeningBasicInfo(screeningId)
  const moreInfo = db.getScreeningMoreInfo(screeningId)
  return {
    id: screeningId,
    ...basicInfo,
    ...moreInfo,
  }
}

export type GetScreeningsSortBy = 'startTime'
export type GetScreeningsFilterCity = 'parkCity' | 'slc'
export type GetScreeningsFilterPremiereType = 'premiere' | 'second'

export function getScreenings({
  sortBy,
  filterCities,
  filterTitles,
  soldOut,
  available,
  screeningType,
} : {
  sortBy?: GetScreeningsSortBy
  filterCities?: GetScreeningsFilterCity[]
  filterTitles?: string[]
  soldOut?: boolean
  available?: boolean
  screeningType?: GetScreeningsFilterPremiereType
} = {}) {
  const screenings = available === true ? db.program : Array.from(db.screenings)
  let results = screenings.map(screeningId => getScreeningInfoStored(screeningId))
  if (filterTitles) {
    results = results.filter(screening => filterTitles.includes(screening.title ?? ''))
  }
  if (soldOut !== undefined) {
    results = results.filter(screening => !!screening.isSoldOut === soldOut)
  }
  if (filterCities) {
    results = results.filter(screening => {
      return filterCities.some(filterCity => {
        switch (filterCity) {
          case 'parkCity':
            return !!screening.isInParkCity
          case 'slc':
            return !!screening.isInSaltLakeCity
          default:
            return screening.location?.endsWith(`, ${filterCity}`)
        }
      })
    })
  }
  if (screeningType !== undefined) {
    results = results.filter(screening => (
      (screeningType === 'premiere' && screening.isPremiere)
      || (screeningType === 'second' && screening.isSecondScreening)
    ))
  }
  if (available !== undefined) {
    results = results.filter(screening => !!screening.isUnavailable !== available)
  }
  if (sortBy) {
    if (sortBy === 'startTime') {
      results.sort((a, b) => {
        return (a.startTime?.getTime() ?? 0) - (b.startTime?.getTime() ?? 0)
      })
    }
  }
  return results
}
