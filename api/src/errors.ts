import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** An error that maps directly to an HTTP response of the form { error: message }. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode

  constructor(status: ContentfulStatusCode, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
