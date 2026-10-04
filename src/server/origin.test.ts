import { afterEach, describe, expect, test } from 'bun:test'
import { desktopOrigins, isLoopbackHost, isWebOrigin, originRuleFor } from './origin'

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

   test('takes the page served on port 80 in production, whose origin names no port', () => {

      inProduction()

      expect(isWebOrigin('http://localhost', 'http://localhost/api/kraken/balance')).toBe(true)
      expect(isWebOrigin('http://localhost', 'http://localhost:50001/api/kraken/balance')).toBe(false)
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

describe('originRuleFor', () => {

   test('gives the web server the rule that takes a local page and no page of the app', () => {

      const isAllowedOrigin = originRuleFor({})

      expect(isAllowedOrigin('http://localhost:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
      expect(isAllowedOrigin('views://main', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
   })

   test('gives the desktop app the rule that takes its own page and no local one', () => {

      const isAllowedOrigin = originRuleFor({ desktop: true })

      expect(isAllowedOrigin('views://main', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
      expect(isAllowedOrigin('http://localhost:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
   })

   test('hands the desktop app the dev server it loaded its page from', () => {

      const isAllowedOrigin = originRuleFor({ desktop: true, devServerOrigin: 'http://localhost:50000' })

      expect(isAllowedOrigin('http://localhost:50000', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(true)
      expect(isAllowedOrigin('http://localhost:50002', 'http://127.0.0.1:50001/api/kraken/balance')).toBe(false)
   })
})

describe('isLoopbackHost', () => {

   test('takes a request addressed to this machine by a loopback name, whatever the port', () => {

      expect(isLoopbackHost('127.0.0.1:50001')).toBe(true)
      expect(isLoopbackHost('localhost:50001')).toBe(true)
      expect(isLoopbackHost('localhost')).toBe(true)
      expect(isLoopbackHost('LOCALHOST:50001')).toBe(true)
   })

   test('refuses a request addressed to a name rebound to this machine', () => {

      expect(isLoopbackHost('example.com:50001')).toBe(false)
      expect(isLoopbackHost('localhost.example.com:50001')).toBe(false)
   })

   test('refuses a request addressed to a network address of this machine', () => {

      expect(isLoopbackHost('192.168.1.20:50001')).toBe(false)
      expect(isLoopbackHost('0.0.0.0:50001')).toBe(false)
   })

   test('refuses a request that names no host', () => {

      expect(isLoopbackHost(undefined)).toBe(false)
      expect(isLoopbackHost('')).toBe(false)
   })
})
