import { TwitterApi, UserV1 } from 'twitter-api-v2';

export const tweetMaxLength = 280
const twitterApiKey = process.env['TWITTER_API_KEY']
const twitterApiSecretKey = process.env['TWITTER_API_SECRET_KEY']
const twitterAccessToken = process.env['TWITTER_ACCESS_TOKEN']
const twitterAccessTokenSecret = process.env['TWITTER_ACCESS_TOKEN_SECRET']
export const twitterUsername = process.env['TWITTER_USERNAME']

let client: TwitterApi | undefined

export function getTwitterApi() {
  if (!client) {
    if (twitterApiKey && twitterApiSecretKey && twitterAccessToken && twitterAccessTokenSecret) {
      // Instantiate with desired auth type
      client = new TwitterApi({
        appKey: twitterApiKey,
        appSecret: twitterApiSecretKey,
        accessToken: twitterAccessToken,
        accessSecret: twitterAccessTokenSecret,
      })
    }
    console.log('using twitter client:', !!client)
  }
  return client
}

let myUser: UserV1 | undefined

export async function getMyUser() {
  if (!myUser) {
    if (twitterUsername) {
      const readOnlyClient = getTwitterApi()?.readOnly
      myUser = await readOnlyClient?.v1.user({
        screen_name: twitterUsername,
      })
    }
    console.log('has twitter user:', !!myUser)
  }
  return myUser
}

export async function sendMyselfTweet(header: string, additionalLines?: string[]) {
  const user = await getMyUser()
  const api = getTwitterApi()
  if (api && user) {
    let message = ''
    let i = 0
    const otherLines = additionalLines || ['']
    while (i < otherLines.length) {
      if (!message) {
        message = header
      }
      let shouldSend = false
      const nextLine = additionalLines ? `\n${additionalLines[i]}` : ''
      const newMessage = message + nextLine
      if (newMessage.length > tweetMaxLength) {
        shouldSend = true
      } else {
        message = newMessage
        ++i
        if (i === otherLines.length - 1) {
          shouldSend = true
        }
      }

      if (shouldSend) {
        await api?.v1.sendDm({
          recipient_id: user.id.toString(),
          text: message,
        })
        message = ''
      }
    }
  }
}
