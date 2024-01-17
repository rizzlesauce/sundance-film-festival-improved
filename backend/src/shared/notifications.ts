// @ts-ignore
import GmailSend = require('gmail-send')
import { sendMyselfTweet, twitterUsername } from './twitter'

export const gmailEmail = process.env['GMAIL_USERNAME']
const gmailPassword = process.env['GMAIL_PASSWORD']

export const usingTwitter = !!twitterUsername
export const usingGmail = !!gmailEmail

export const sendGmail = usingGmail ? GmailSend({
  user: gmailEmail,
  pass: gmailPassword,
  to: gmailEmail,
}) : undefined

export async function sendNotification(header: string, additionalLines?: string[]) {
  if (usingTwitter) {
    await sendMyselfTweet(header, additionalLines)
  }
  if (usingGmail) {
    sendGmail({
      subject: header,
      text: additionalLines ? additionalLines.join('\n') : header,
    })
  }
}
