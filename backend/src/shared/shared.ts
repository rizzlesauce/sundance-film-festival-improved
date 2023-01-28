import webdriver, { By, until, WebDriver, WebElement } from 'selenium-webdriver'
import { parse, addDays } from 'date-fns'
import db, {
  FilmCategory,
  Credit,
  FilmInfo,
  ScreeningBasicInfo,
  ScreeningMoreInfo,
  FilmTitleAndId,
} from './db'
import { sendMyselfTweet } from './twitter'

let ops: (() => void)[] = []

export const state = {
  inOp: 0,
  runningMain: true,
  screeningIndex: -1,
}

export async function scrollElementIntoView(element: WebElement, message?: string) {
  await element.getDriver().executeScript('arguments[0].scrollIntoView(true);', element)
  await element.getDriver().wait(until.elementIsVisible(element), waitTime(5000), message)
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
export const programUrl = `${baseUrl}/program`
export const filmsUrl = `${programUrl}/films`
export const filmUrl = (filmId: string) => `${programUrl}/film/${filmId}`
export const shortsInfoUrl = (shortId: string) => `${programUrl}/short-info/${shortId}`
export const ticketsUrl = `${baseUrl}/tickets`
export const cartUrl = `${ticketsUrl}/cart`

export const filmOrShortsInfoUrlRegex = new RegExp(`${programUrl}/(film|short-info)/([a-zA-Z0-9]+)`)
export const filmUrlRegex = new RegExp(filmUrl('([a-zA-Z0-9]+)'))
export const shortsInfoUrlRegex = new RegExp(shortsInfoUrl('([a-zA-Z0-9]+)'))

export function getEventIdFromUrl(url: string) {
  const result = filmOrShortsInfoUrlRegex.exec(url)
  if (!result) {
    throw new Error(`invalid film or shorts url: ${url}`)
  }
  const eventTypeString = result[1]
  let eventType: 'film' | 'shorts'
  switch (eventTypeString) {
    case 'film':
      eventType = 'film'
      break
    case 'short-info':
      eventType = 'shorts'
      break
    default:
      throw new Error(`invalid event type: ${eventTypeString}`)
  }
  const eventId = result[2]
  return {
    eventType,
    eventId,
  }
}

export function getFilmIdFromUrl(url: string) {
  const filmId = filmUrlRegex.exec(url)?.[1]
  if (!filmId) {
    throw new Error('failed to parse film id')
  }
  return filmId
}

export function getShortsIdFromUrl(url: string) {
  const shortsId = shortsInfoUrlRegex.exec(url)?.[1]
  if (!shortsId) {
    throw new Error('failed to parse shorts id')
  }
  return shortsId
}

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

export function filterBySearchStrings<R>({
  needles,
  haystack,
  getValues,
  or,
}: {
  needles: string[]
  haystack: R[]
  getValues: (record: R) => string[]
  or?: (record: R, needle: string) => boolean
}) {
  const exactNeedleSet = new Set<string>()
  const fuzzyNeedleSet = new Set<string>()
  const fuzzyNeedleMarker = '~'
  needles.forEach(needle => {
    if (needle.startsWith(fuzzyNeedleMarker)) {
      const fuzzyNeedle = needle.substring(fuzzyNeedleMarker.length).trim().toLowerCase()
      if (fuzzyNeedle) {
        fuzzyNeedleSet.add(fuzzyNeedle)
      }
    } else {
      const exactNeedle = needle.trim()
      if (exactNeedle) {
        exactNeedleSet.add(exactNeedle)
      }
    }
  })
  if (!exactNeedleSet.size && !fuzzyNeedleSet.size) {
    return haystack
  }
  const fuzzyNeedles = Array.from(fuzzyNeedleSet)
  const result = haystack.filter(record => {
    return getValues(record).some(value => {
      if (exactNeedleSet.has(value)) {
        return true
      }
      const lowerValue = value.toLowerCase()
      return fuzzyNeedles.some(fuzzyNeedle => lowerValue.includes(fuzzyNeedle))
    }) || (
      or && needles.some(needle => or(record, needle))
    )
  })
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
  const firstPartLocator = By.css('.sd_first_select_film')
  await screening.getDriver().wait(until.elementLocated(firstPartLocator), waitTime(3000))
  const firstPart = await screening.findElement(By.css('.sd_first_select_film'))
  await scrollElementIntoView(firstPart)

  const titleLocator = By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Title})`)
  let title = ''
  await firstPart.getDriver().wait(async () => {
    const titleElements = await firstPart.findElements(titleLocator)
    title = titleElements ? await titleElements[0].getText() : ''
    return !!title
  }, waitTime(3000), 'title')
  let dateString = ''
  await firstPart.getDriver().wait(async () => {
    dateString = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Date})`)).getText()
    return !!dateString
  }, waitTime(1000), 'dateString')
  const timeRangeAndScreeningTypeTd = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.TimeRangeAndScreeningType})`))
  let timeRangeString = ''
  await firstPart.getDriver().wait(async () => {
    timeRangeString = await timeRangeAndScreeningTypeTd.findElement(By.css(':scope > p:nth-child(1)')).getText()
    return !!timeRangeString
  }, waitTime(1000), 'timeRangeString')
  let location = ''
  await firstPart.getDriver().wait(async () => {
    location = await firstPart.findElement(By.css(`:scope > td:nth-child(${ScreeningInfoChildNumber.Location})`)).getText()
    return !!location
  }, waitTime(1000), 'location')
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
    title,
    id: screeningId,
    firstPart,
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

export async function scrapeFilmCategoryEventCard(eventCard: WebElement): Promise<FilmCategory> {
  await scrollElementIntoView(eventCard)
  const title = await eventCard.findElement(By.css('.sd_event_card_desc > h2')).getText()
  const description = await eventCard.findElement(By.css('.sd_event_card_desc_content')).getText()
  return {
    title,
    description,
    updatedAt: new Date(),
  }
}

export async function refreshCategories(driver: WebDriver) {
  await driver.get(programUrl)

  const eventCardLocator = By.css('.sd_event_card')
  await driver.wait(until.elementLocated(eventCardLocator), waitTime(7000))
  const eventCards = await driver.findElements(eventCardLocator)

  const results: FilmCategory[] = []

  for (let i = 0; i < eventCards.length; ++i) {
    const eventCard = eventCards[i]
    const category = await scrapeFilmCategoryEventCard(eventCard)
    db.setFilmCategory(category.title, category)
    console.log(`${i}) ${category.title}`)
    results.push(category)
  }

  db.categories = new Set(results.map(category => category.title))

  const { allCategories } = db
  results.forEach(category => {
    allCategories.add(category.title)
  })
  db.allCategories = allCategories

  return results
}

export async function waitForLoadingDone({
  driver,
  waitFind = 5000,
  waitStale = 7000,
}: {
  driver: WebDriver,
  waitFind?: number
  waitStale?: number
}) {
  const loadingLocator = By.css('.sd_loader')
  let loading: WebElement | undefined
  try {
    await driver.wait(until.elementLocated(loadingLocator), waitTime(waitFind))
    loading = driver.findElement(loadingLocator)
  } catch (e) {
    console.warn('loading not found')
  }
  if (loading) {
    await driver.wait(until.stalenessOf(loading), waitTime(waitStale))
  }
}

export async function refreshFilms(driver: WebDriver) {
  await driver.get(filmsUrl)

  const films = new Map<string, FilmTitleAndId>()
  let lastPage = 0
  let lastPageFirstEventId = ''
  const seenEventIds = new Set<string>()

  await waitForLoadingDone({ driver })

  while (true) {
    let newCardsNotYetLoadedCount = -1
    let lastEventCardsLength = 0
    let lastEventCardFoundTime = Number.MAX_VALUE
    let eventCards: WebElement[] = []
    const thresholdMs = 1500
    await driver.wait(async () => {
      eventCards = await driver.findElements(By.css('.sd_event_card'))
      if (eventCards.length) {
        const now = new Date().getTime()
        const msPassed = now - lastEventCardFoundTime
        if (eventCards.length > lastEventCardsLength) {
          lastEventCardsLength = eventCards.length
          lastEventCardFoundTime = now
        } else if (msPassed > thresholdMs) {
          return true
        }
      }
    }, waitTime(7000), 'event cards loaded')

    console.log('lastPage', lastPage)

    let currentPage = -1
    await driver.wait(async () => {
      currentPage = +(await driver.findElement(By.css('.pagination .active a')).getText())
      return currentPage === lastPage + 1
    }, waitTime(5000), 'page number incremented')
    lastPage = currentPage

    const paginationButtons = await driver.findElements(By.css('.pagination a'))
    const totalPages = +(await paginationButtons[paginationButtons.length - 2]?.getText())
    const nextButtonContainer = await driver.findElement(By.css('.pagination .next'))
    const nextIsDisabled = (await nextButtonContainer.getAttribute('class')).split(/\s+/).includes('disabled')
    const isLastPage = nextIsDisabled && currentPage === totalPages
    console.log('totalPages', totalPages)
    console.log('currentPage', currentPage)
    console.log('nextIsDisabled', nextIsDisabled)
    console.log('isLastPage', isLastPage)

    for (let cardIndex = 0; cardIndex < eventCards.length; ++cardIndex) {
      const card = eventCards[cardIndex]
      await scrollElementIntoView(card)
      const title = await card.findElement(By.css('.sd_event_card_desc h2')).getText()
      const url = await card.getAttribute('href')
      let eventId
      let eventType: 'film' | 'shorts'
      try {
        eventId = getFilmIdFromUrl(url)
        eventType = 'film'
      } catch (e) {
        eventId = getShortsIdFromUrl(url)
        eventType = 'shorts'
      }
      if (cardIndex === 0) {
        if (eventId === lastPageFirstEventId) {
          if (newCardsNotYetLoadedCount < 0) {
            newCardsNotYetLoadedCount = 5
          } else {
            newCardsNotYetLoadedCount -= 1
          }
          break
        } else {
          lastPageFirstEventId = eventId
        }
      }
      console.log(`${cardIndex + 1}) ${title} ${eventType} ${eventId}`)
      if (seenEventIds.has(eventId)) {
        console.warn(`skipping duplicate event id (already seen ${eventId} this round)`)
        continue
      }
      const tagLine = await card.findElement(By.css('.sd_event_card_desc_content')).getAttribute('innerHTML')
      const titleAndId = {
        title,
        id: eventId,
        isShorts: eventType === 'shorts' || undefined,
        updatedAt: new Date(),
      }
      films.set(eventId, titleAndId)
      db.setFilmBasicInfo(eventId, {
        ...titleAndId,
        url,
        tagLine,
      })
      const { allFilms } = db
      allFilms.set(eventId, titleAndId)
      db.allFilms = allFilms
    }

    if (newCardsNotYetLoadedCount >= 0) {
      console.warn(`new cards not yet loaded; tries remaining: ${newCardsNotYetLoadedCount}`)
      if (newCardsNotYetLoadedCount === 0) {
        throw new Error('failed to get next page event cards')
      }
      continue
    }

    if (isLastPage) {
      break
    }

    //await scrollElementIntoView(nextButton)
    await nextButtonContainer.click()
  }

  db.films = films
  return Array.from(films.values())
}

export async function refreshSpecifiedEventInfoFromCurrentPage(
  driver: WebDriver,
  isShorts?: boolean,
  parentEventId?: string,
): Promise<FilmInfo> {
  console.log('refreshSpecifiedEventInfoFromCurrentPage()')
  await driver.wait(
    until.urlMatches(isShorts ? shortsInfoUrlRegex : filmUrlRegex),
    waitTime(7000)
  )

  const url = await driver.getCurrentUrl()
  const eventId = isShorts ? getShortsIdFromUrl(url) : getFilmIdFromUrl(url)

  let category = ''
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css('.sd_film_desc_label'))
    if (elements.length) {
      category = (await elements[0].getAttribute('textContent')).trim()
    }
    return !!category
  }, waitTime(5000), 'category')
  let title = ''
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css('.sd_film_description h2.sd_textuppercase'))
    if (elements.length) {
      title = (await elements[0].getAttribute('textContent')).trim()
    }
    return !!title
  }, waitTime(5000), 'category')

  const description = await driver.findElement(By.css('.sd_film_description_content')).getAttribute('innerHTML')

  const tagElements = await driver.findElements(By.css('.sd_film_description_content_cat > span'))
  const tags = new Set<string>
  for (const tagElement of tagElements) {
    const tag = (await tagElement.getAttribute('textContent')).trim()
    if (tag) {
      tags.add(tag)
    }
  }

  const panelistName = isShorts ? '' : await driver.findElement(By.css('.sd_panelist_name > h3')).getText()
  const panelistDescription = isShorts ? '' : await driver.findElement(By.css('.sd_panelist_desc .sd_rtf_content')).getAttribute('innerHTML')
  const creditElements = isShorts ? [] : await driver.findElements(By.css('.sd_film_artists_credits_sec li'))

  const credits: Credit[] = []
  for (const credit of creditElements) {
    const name = (await credit.findElement(By.css('.sd_film_artists_cr_pos')).getAttribute('textContent')).trim()
    if (!name) {
      continue
    }
    const valueElements = await credit.findElements(By.css('.sd_film_artists_cr_name > p'))
    const values: string[] = []
    for (const valueElement of valueElements) {
      const value = (await valueElement.getAttribute('textContent')).trim()
      if (value) {
        values.push(value)
      }
    }
    credits.push({
      name,
      values,
    })
  }

  const filmInfos = new Array<FilmInfo>()
  if (isShorts) {
    let shortsIndex = 0
    let totalShorts = -1
    let lastTotalShorts = -1
    const idsSeen = new Set<string>()
    const shortLinkLocator = By.css('.sd_film_description .sd_film_desc_timings > div.short_links > a')
    for (; totalShorts < 0 || shortsIndex < totalShorts; ++shortsIndex) {
      await driver.wait(until.elementLocated(shortLinkLocator), waitTime(7000))
      const shortLinks = await driver.findElements(shortLinkLocator)
      totalShorts = shortLinks.length
      if (lastTotalShorts < 0) {
        lastTotalShorts = totalShorts
      }
      if (totalShorts < lastTotalShorts) {
        shortsIndex -= 1
        continue
      }
      console.log('shorts: ', shortLinks.length)
      if (shortsIndex < totalShorts) {
        const shortLink = shortLinks[shortsIndex]
        //await scrollElementIntoView(shortLink, 'short link')
        await driver.wait(until.elementIsVisible(shortLink), waitTime(3000), 'short link')

        const shortTitle = await shortLink.getText()
        console.log(`${shortsIndex + 1}) (short) ${shortTitle}`)

        await shortLink.click()
        const info = await refreshSpecifiedEventInfoFromCurrentPage(driver, false, eventId)
        if (!idsSeen.has(info.id)) {
          filmInfos.push(info)
          idsSeen.add(info.id)
        }
        if (shortsIndex < totalShorts - 1) {
          await driver.get(url)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
  }

  const filmTitleAndId = {
    title,
    id: eventId,
    isShorts: isShorts || undefined,
    ...parentEventId && {
      parentEventId,
    },
    updatedAt: new Date(),
  }

  const info = {
    ...filmTitleAndId,
    url,
    panelist: {
      name: panelistName,
      description: panelistDescription,
    },
    description,
    tags: Array.from(tags),
    category,
    credits,
    films: filmInfos.length ? filmInfos.map(film => ({
      title: film.title,
      id: film.id,
    })) : undefined,
  }

  db.setFilmInfo(eventId, info)

  const { films } = db
  films.set(filmTitleAndId.id, filmTitleAndId)
  db.films = films

  const { allFilms } = db
  allFilms.set(filmTitleAndId.id, filmTitleAndId)
  db.allFilms = allFilms

  return info
}

export async function refreshFilmInfoFromId(driver: WebDriver, filmId: string): Promise<FilmInfo> {
  await driver.get(filmUrl(filmId))

  return await refreshSpecifiedEventInfoFromCurrentPage(driver)
}

export async function refreshShortsInfoFromId(driver: WebDriver, shortsId: string): Promise<FilmInfo> {
  await driver.get(shortsInfoUrl(shortsId))

  return await refreshSpecifiedEventInfoFromCurrentPage(driver, true)
}

export async function refreshEventInfoFromCurrentPage(driver: WebDriver) {
  await driver.wait(until.urlMatches(filmOrShortsInfoUrlRegex), waitTime(7000))

  const url = await driver.getCurrentUrl()
  const {
    eventType,
    eventId,
  } = getEventIdFromUrl(url)

  if (eventType === 'film') {
    return await refreshFilmInfoFromId(driver, eventId)
  } else if (eventType === 'shorts') {
    return await refreshShortsInfoFromId(driver, eventId)
  } else {
    throw new Error(`unsupported event type: ${eventType}`)
  }
}

export async function refreshFilmInfoFromTitleSearch(driver: WebDriver, titleSearch: string): Promise<FilmInfo> {
  await driver.get(filmsUrl)

  await waitForLoadingDone({ driver })

  const searchButtonLocator = By.css('.sd_menu_search button')
  await driver.wait(until.elementLocated(searchButtonLocator), waitTime(3000))
  const searchButton = await driver.findElement(searchButtonLocator)
  await driver.wait(until.elementIsVisible(searchButton), waitTime(5000))
  await searchButton.click()

  const searchInputLocator = By.css('.sd_popup_search_input input')
  await driver.wait(until.elementLocated(searchInputLocator), waitTime(3000))
  await driver.findElement(searchInputLocator).sendKeys(titleSearch)

  const filmEntryLocator = By.css('.sd_popup_table table tbody tr')
  await driver.wait(until.elementLocated(filmEntryLocator), waitTime(7000))
  const filmEntry = await driver.findElement(filmEntryLocator)
  await filmEntry.findElement(By.css(':scope > td')).click()

  return await refreshEventInfoFromCurrentPage(driver)
}

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

  const newlyAvailableScreenings: ScreeningBasicInfo[] = []
  for (let i = 0; i < screeningsActual.length; ++i) {
    const screening = screeningsActual[i]
    const basicInfo = await getBasicScreeningInfo(screening)
    console.log(`${i + 1}) ${basicInfo.id}`)
    basicInfos.push(basicInfo)
    const {
      id,
      firstPart,
      timeRangeAndScreeningTypeTd,
      ...rest
    } = basicInfo
    const storedBasicInfo = db.getScreeningBasicInfo(basicInfo.id)
    if (!storedBasicInfo || storedBasicInfo.isUnavailable) {
      newlyAvailableScreenings.push(basicInfo)
    }
    db.setScreeningBasicInfo(basicInfo.id, rest)
  }

  const newlyAvailableScreeningTitles = Array.from(new Set(newlyAvailableScreenings.map(info => info.title)))
  if (newlyAvailableScreeningTitles.length) {
    await sendMyselfTweet('Newly available screenings:', newlyAvailableScreeningTitles)
  }

  const program = basicInfos.map(({ id }) => id)
  db.program = program
  const programSet = new Set(program)

  const { screenings: newScreenings } = db

  for (const screeningId of newScreenings) {
    if (!programSet.has(screeningId)) {
      const storedBasicInfo = db.getScreeningBasicInfo(screeningId)
      if (storedBasicInfo && !storedBasicInfo.isUnavailable) {
        db.setScreeningBasicInfo(screeningId, {
          ...storedBasicInfo,
          isUnavailable: true,
        })
      }
    }
  }

  programSet.forEach(screeningId => {
    newScreenings.add(screeningId)
  })
  db.screenings = newScreenings

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
    title,
    id,
    dateString,
    timeRangeString,
    location,
    isInParkCity,
    isInSaltLakeCity,
    startTime,
    endTime,
  } = basicInfo

  console.log(`${screeningIndex}. ${id}`)

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

  let storedMoreInfo = db.getScreeningMoreInfo(screeningId)
  let newMoreInfo = {
    ...storedMoreInfo,
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
              }, waitTime(3000))
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
    let isTicketSoldOut: boolean | undefined = (ticketType || '').endsWith('(SOLD OUT)') || undefined
    if (isTicketSoldOut) {
      console.log('SOLD OUT')
    }

    storedMoreInfo = db.getScreeningMoreInfo(screeningId)
    if (!!storedMoreInfo?.isSoldOut !== !!isTicketSoldOut) {
      await sendMyselfTweet(
        `Screening ${isTicketSoldOut ? 'sold out' : 'tickets available'}: ${basicInfo.id}`,
      )
    }
    newMoreInfo = {
      ...storedMoreInfo || newMoreInfo,
      ticketType,
      isSoldOut: isTicketSoldOut,
      updatedAt: new Date(),
    }
    db.setScreeningMoreInfo(screeningId, newMoreInfo)

    let purchased = false
    if (purchaseTicketCount !== undefined) {
      const term1Locator = By.xpath('//input[@type="checkbox" and @name="sundanceTerm1"]')
      await driver.wait(until.elementLocated(term1Locator), waitTime(3000))
      await driver.findElement(term1Locator).click()

      const term2Locator = By.xpath('//input[@type="checkbox" and @name="sundanceTerm2"]')
      await driver.wait(until.elementLocated(term2Locator), waitTime(3000))
      await driver.findElement(term2Locator).click()

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
          isTicketSoldOut = numberRemaining === 0
          storedMoreInfo = db.getScreeningMoreInfo(screeningId)
          if (!!storedMoreInfo?.isSoldOut !== !!isTicketSoldOut) {
            await sendMyselfTweet(
              `Screening ${isTicketSoldOut ? 'sold out' : `tickets available (${numberRemaining})`}: ${basicInfo.id}`,
            )
          }
          newMoreInfo = {
            ...storedMoreInfo || newMoreInfo,
            isSoldOut: isTicketSoldOut,
            ticketsRemaining: numberRemaining || undefined,
            updatedAt: new Date(),
          }
          db.setScreeningMoreInfo(screeningId, newMoreInfo)
        }
      } else {
        console.log('purchased successful')
        purchased = true
      }

      if (purchased) {
        storedMoreInfo = db.getScreeningMoreInfo(screeningId)
        newMoreInfo = {
          ...storedMoreInfo || newMoreInfo,
          ticketsPurchased: (storedMoreInfo?.ticketsPurchased ?? 0) + purchaseTicketCount,
          updatedAt: new Date(),
        }
        db.setScreeningMoreInfo(screeningId, newMoreInfo)
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
    info: pruneScreeningInfo(info),
  }
}

function getFilmInfoStored<
  T extends (
    Omit<FilmTitleAndId, 'updatedAt'>
    & Partial<Pick<FilmTitleAndId, 'updatedAt'>>
  )
>(
  titleAndId: T
) {
  const basicInfo = db.getFilmBasicInfo(titleAndId.id)
  const moreInfo = db.getFilmInfo(titleAndId.id)
  const result = {
    ...titleAndId,
    url: titleAndId.isShorts ? shortsInfoUrl(titleAndId.id) : filmUrl(titleAndId.id),
    basicInfo: basicInfo && {
      ...basicInfo,
      id: undefined,
      title: undefined,
      url: undefined,
      isShorts: undefined,
      tagLine: ((basicInfo.tagLine === String.raw`<p></p>\n`) || undefined) && basicInfo.tagLine,
    },
    moreInfo: moreInfo && {
      ...moreInfo,
      title: undefined,
      id: undefined,
      url: undefined,
      description: ((moreInfo.description === String.raw`<p></p>\n`) || undefined) && moreInfo.description,
      panelist: (moreInfo.panelist.name || undefined) && moreInfo.panelist,
      credits: (moreInfo.credits.length || undefined) && moreInfo.credits,
      films: moreInfo.films?.length ? moreInfo.films?.map(film => ({
        ...film,
        url: filmUrl(film.id),
      })) : undefined,
    },
  }
  return result
}

export function getFilmInfoStoredComplete<
  T extends (
    Omit<FilmTitleAndId, 'updatedAt'>
    & Partial<Pick<FilmTitleAndId, 'updatedAt'>>
  )
>(
  titleAndId: T
) {
  const result = getFilmInfoStored(titleAndId)
  return {
    ...result,
    moreInfo: result.moreInfo && {
      ...result.moreInfo,
      films: result.moreInfo.films?.map(film => {
        const info = getFilmInfoStored(film)
        return {
          ...info,
          moreInfo: info.moreInfo && {
            ...info.moreInfo,
            parentEventId: undefined,
          },
        }
      }),
    }
  }
  return result
}

export type FilmInfoVerbosity = 'essential' | 'basic' | 'short' | 'tags' | 'credits' | 'verbose'

export function pruneFilmInfo({
  film,
  verbosity = 'basic',
  noTitle,
} : {
  film: ReturnType<typeof getFilmInfoStoredComplete>
  verbosity?: FilmInfoVerbosity
  noTitle?: boolean
}) {
  return {
    ...film,
    ...noTitle && {
      title: undefined,
    },
    basicInfo: (
      verbosity === 'essential'
        ? undefined
        : film.basicInfo
    ),
    moreInfo: (
      (verbosity === 'essential' || !film.moreInfo)
        ? undefined
        : (
          verbosity === 'verbose'
            ? film.moreInfo
            : {
              category: film.moreInfo.category,
              updatedAt: film.moreInfo.updatedAt,
              ...verbosity !== 'basic' && {
                panelist: film.moreInfo.panelist && {
                  name: film.moreInfo.panelist.name,
                },
                ...verbosity !== 'short' && {
                  tags: film.moreInfo.tags,
                  ...verbosity !== 'tags' && {
                    credits: film.moreInfo.credits,
                  },
                },
              },
            }
        )
    ),
  }
}

export function getFilmsByTitle(title: string) {
  return Array.from(db.allFilms.values())
    .filter(titleAndId => titleAndId.title === title)
    .map(titleAndId => getFilmInfoStoredComplete(titleAndId))
}

export function getScreeningInfoStored(screeningId: string, withFilmInfo = false) {
  const basicInfo = db.getScreeningBasicInfo(screeningId)
  const moreInfo = db.getScreeningMoreInfo(screeningId)
  const filmInfos = (withFilmInfo && basicInfo) ? getFilmsByTitle(basicInfo.title) : undefined
  return {
    id: screeningId,
    basicInfo,
    moreInfo,
    filmInfos,
  }
}

export function pruneScreeningInfo(
  screening: ReturnType<typeof getScreeningInfoStored>,
  verbosity: FilmInfoVerbosity = 'basic',
) {
  return {
    ...screening,
    basicInfo: screening.basicInfo && {
      ...screening.basicInfo,
      dateString: undefined,
      timeRangeString: undefined,
      isInParkCity: undefined,
      isInSaltLakeCity: undefined,
    },
    moreInfo: screening.moreInfo && {
      ...screening.moreInfo,
      isPremiere: undefined,
      isSecondScreening: undefined,
    },
    filmInfos: screening.filmInfos?.map(film => pruneFilmInfo({ film, verbosity, noTitle: true }))
  }
}

export type GetScreeningsSortBy = 'startTime'
export type GetScreeningsFilterCity = 'parkCity' | 'slc'
export type GetScreeningsFilterPremiereType = 'premiere' | 'second'

export function getScreenings({
  sortBy,
  filterVenues,
  filterCities,
  filterTitles,
  soldOut,
  available,
  screeningTypes,
  filterCategories,
  filterTags,
  filterFilmIds,
  withFilmInfo,
} : {
  sortBy?: GetScreeningsSortBy
  filterVenues?: string[]
  filterCities?: (GetScreeningsFilterCity | string)[]
  filterTitles?: string[]
  soldOut?: boolean
  available?: boolean
  screeningTypes?: (GetScreeningsFilterPremiereType | string)[]
  filterCategories?: string[]
  filterTags?: string[]
  filterFilmIds?: string[]
  withFilmInfo?: boolean
} = {}) {
  const screenings = available === true ? db.program : Array.from(db.screenings)
  const actualWithFilmInfo = (
    withFilmInfo
    || !!filterCategories?.length
    || !!filterTags?.length
    || !!filterFilmIds?.length
  )
  let results = screenings.map(screeningId => getScreeningInfoStored(screeningId, actualWithFilmInfo))
  if (filterTitles?.length) {
    results = filterBySearchStrings({
      needles: filterTitles,
      haystack: results,
      getValues: screening => [screening.basicInfo?.title ?? ''],
    })
  }
  if (soldOut !== undefined) {
    results = results.filter(screening => !!screening.moreInfo?.isSoldOut === soldOut)
  }
  const cityPrefix = ', '
  const getCityPrefixIndex = (str: string) => str.lastIndexOf(cityPrefix)
  if (filterVenues?.length) {
    results = filterBySearchStrings({
      needles: filterVenues,
      haystack: results,
      getValues: screening => {
        const cityIndex = getCityPrefixIndex(screening.basicInfo?.location ?? '')
        if (cityIndex !== -1) {
          const venue = screening.basicInfo?.location.substring(0, cityIndex) ?? ''
          return [venue]
        }
        return []
      },
    })
  }
  if (filterCities?.length) {
    results = filterBySearchStrings({
      needles: filterCities,
      haystack: results,
      getValues: screening => {
        const cityIndex = getCityPrefixIndex(screening.basicInfo?.location ?? '')
        if (cityIndex !== -1) {
          const city = screening.basicInfo?.location.substring(cityIndex + cityPrefix.length) ?? ''
          return [city]
        }
        return []
      },
      or: (screening, needle) => {
        switch (needle) {
          case 'parkCity':
            return !!screening.basicInfo?.isInParkCity
          case 'slc':
            return !!screening.basicInfo?.isInSaltLakeCity
          default:
            return false
        }
      },
    })
  }
  if (screeningTypes?.length) {
    results = filterBySearchStrings({
      needles: screeningTypes,
      haystack: results,
      getValues: screening => [screening.moreInfo?.screeningType ?? ''].filter(v => !!v),
      or: (screening, screeningType) => (
        (screeningType === 'premiere' && !!screening.moreInfo?.isPremiere)
        || (screeningType === 'second' && !!screening.moreInfo?.isSecondScreening)
      ),
    })
  }
  if (filterFilmIds?.length) {
    results = filterBySearchStrings({
      needles: filterFilmIds,
      haystack: results,
      getValues: screening => (screening.filmInfos ?? []).map(
        film => film.id,
      ),
    })
  }
  if (filterCategories?.length) {
    results = filterBySearchStrings({
      needles: filterCategories,
      haystack: results,
      getValues: screening => (screening.filmInfos ?? []).flatMap(
        film => [film.moreInfo?.category ?? ''].filter(v => !!v),
      ),
    })
  }
  if (filterTags?.length) {
    results = filterBySearchStrings({
      needles: filterTags,
      haystack: results,
      getValues: screening => (screening.filmInfos ?? []).flatMap(
        film => film.moreInfo?.tags ?? [],
      ),
    })
  }
  if (available !== undefined) {
    results = results.filter(screening => !!screening.basicInfo?.isUnavailable !== available)
  }
  if (sortBy) {
    if (sortBy === 'startTime') {
      results.sort((a, b) => {
        return (a.basicInfo?.startTime?.getTime() ?? 0) - (b.basicInfo?.startTime?.getTime() ?? 0)
      })
    }
  }
  return results
}
