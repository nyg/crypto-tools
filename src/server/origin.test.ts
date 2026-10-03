import { afterEach, describe, expect, test } from 'bun:test'
import { desktopOrigins, isWebOrigin } from './origin'

const nodeEnv = process.env.NODE_ENV

const inProduction = () => {
   process.env.NODE_ENV = 'production'
}

afterEach(() => {
   process.env.NODE_ENV = nodeEnv
})

describe('isWebOrigin', () => {

   test('takes a local page on any port in development', () => {

      expect(isWebOrigin('http://localhost:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
   })

   test('refuses a page that is not local in development', () => {

      expect(isWebOrigin('https://example.com', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
      expect(isWebOrigin('http://localhost.example.com:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
   })

   test('takes the page the server served itself in production, whatever the port', () => {

      inProduction()

      expect(isWebOrigin('http://127.0.0.1:50001', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
      expect(isWebOrigin('http://localhost:50001', 'http://localhost:50001/api/kraken/balance')).toBe(true)
   })

   test('refuses a local page on another port in production', () => {

      inProduction()

      expect(isWebOrigin('http://localhost:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
   })

   test('refuses a name rebound to this machine in production, though the request is addressed to it', () => {

      inProduction()

      expect(isWebOrigin('http://example.com:50001', 'http://example.com:50001/api/kraken/balance')).toBe(false)
   })
})

describe('desktopOrigins', () => {

   test('takes the app\'s own page', () => {

      const isDesktopOrigin = desktopOrigins()

      expect(isDesktopOrigin('views://main', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
   })

   test('refuses every local page, in development too, when the app loaded none', () => {

      const isDesktopOrigin = desktopOrigins()

      expect(isDesktopOrigin('http://localhost:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
      expect(isDesktopOrigin('http://127.0.0.1:50001', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
   })

   test('takes the dev server the app loaded its page from, and no other local page', () => {

      const isDesktopOrigin = desktopOrigins('http://localhost:50000')

      expect(isDesktopOrigin('http://localhost:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
      expect(isDesktopOrigin('http://localhost:50002', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
      expect(isDesktopOrigin('views://main', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
   })
})
