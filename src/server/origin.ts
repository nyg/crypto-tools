export type OriginRule = (origin: string, requestUrl: string) => boolean

const localhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

// The browser sends Origin on same-origin writes too, and no port is fixed. Development
// takes any local page, since Vite's port is its own; production only the page this
// server served, which is the origin the request was addressed to. The loopback test
// stays on in both, or a rebound DNS name would pass as same-origin.
export const isWebOrigin: OriginRule = (origin, requestUrl) =>
   localhostOrigin.test(origin)
   && (process.env.NODE_ENV !== 'production' || origin === new URL(requestUrl).origin)

// The desktop app names its pages rather than asking NODE_ENV, which its bundler inlines
// as 'development' in every channel: a released build would take any local page.
export const desktopOrigins = (devServerOrigin?: string): OriginRule =>
   origin => origin.startsWith('views://') || origin === devServerOrigin
