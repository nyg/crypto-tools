import type { Studio } from '../../studio'

const titleCard = `
   <div class="kicker">Crypto Tools</div>
   <div class="title">Portfolios on Bybit</div>
   <div class="sub">Target weights, previews, and market orders that put you back on target.</div>
   <div class="note">Sample data. No real funds were traded in this video.</div>`

const laterCard = `
   <div class="kicker">Meanwhile</div>
   <div class="title">Three weeks later</div>`

const endCard = `
   <div class="kicker">Crypto Tools</div>
   <div class="title">Portfolios on Bybit</div>
   <div class="sub">github.com/nyg/crypto-tools</div>`

const targets: [string, string][] = [['SOL', '30'], ['NEAR', '20'], ['VVV', '20'], ['PUMP', '15'], ['COOKIE', '15']]

const moves = { PUMP: 1.8, SOL: 1.25, VVV: 0.85, NEAR: 1.05, COOKIE: 0.6, BTC: 1.04, ETH: 1.06 }

export default async function scene(studio: Studio) {

   const { page } = studio

   const dialog = page.locator('[data-slot="dialog-content"]')
   const confirmDialog = page.getByRole('alertdialog')
   const footerButton = (name: string) => dialog.locator('[data-slot="dialog-footer"] button', { hasText: name })
   const cardButton = (name: string) => page.locator('[data-slot="card"]').first().getByRole('button', { name, exact: true })
   const portfolioTitle = page.locator('[data-slot="card-title"]').first()
   const holdingsTable = page.locator('[data-slot="card"]').first().locator('table')
   const accountCard = page.locator('[data-slot="card"]').last()
   const accountCash = accountCard.locator('tr', { hasText: 'USDT' }).first()
   const blurFocus = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

   await page.goto(`${studio.baseUrl}/bybit/portfolios`)
   await page.getByText('Bybit account').waitFor()
   await page.mouse.move(900, 460)
   await studio.card(titleCard)
   await studio.startCapture()
   await studio.pause(400)
   studio.markStart()

   await studio.pause(1200)
   studio.speak('intro')
   await studio.pause(4200)
   await studio.card(null)
   await studio.moveTo(760, 300, 900)
   await studio.quiet()

   studio.speak('account')
   await studio.pause(300)
   await studio.spot(accountCash, 4)
   await studio.hover(accountCash.locator('td').nth(3))
   await studio.quiet()
   await studio.spot(null)

   studio.speak('create')
   await studio.click(page.getByRole('button', { name: 'New portfolio' }), { settle: 700 })
   await studio.quiet()

   studio.speak('band')
   await studio.click(page.locator('#portfolio-name'), { settle: 150 })
   await studio.type('Alt basket')
   await studio.pause(500)
   await studio.spot(page.locator('#portfolio-band'), 4)
   await studio.replace(page.locator('#portfolio-band'), '3')
   await studio.quiet()
   await studio.spot(null)

   studio.speak('targets')
   for (const [index, [asset, weight]] of targets.entries()) {
      if (index === 1) studio.speak('weights')
      if (index >= 3) await studio.click(dialog.getByRole('button', { name: 'Add asset' }), { settle: 150, ms: 420 })
      await studio.click(dialog.locator('button[id^="target-asset-"]').nth(index), { settle: 220, ms: 420 })
      await studio.type(asset, 55)
      await studio.pause(120)
      await page.keyboard.press('Enter')
      await studio.pause(150)
      await studio.replace(dialog.locator('input[id^="target-weight-"]').nth(index), weight)
      await studio.pause(100)
   }
   await studio.quiet()

   studio.speak('total')
   await studio.spot(dialog.getByText('Total 100%'), 6)
   await studio.hover(dialog.getByText('Total 100%'))
   await studio.quiet()
   await studio.spot(null)
   await studio.click(footerButton('Create'), { settle: 900 })

   studio.speak('created')
   await studio.hover(portfolioTitle, { x: 40 })
   await studio.quiet()

   studio.speak('deposit')
   await studio.click(cardButton('Deposit'), { settle: 700 })
   await studio.click(page.locator('#deposit-amount'), { settle: 150 })
   await studio.type('5000')
   await studio.pause(600)
   await studio.click(footerButton('Deposit'), { settle: 1200 })
   await studio.spot(accountCash, 4)
   await studio.quiet()
   await studio.spot(null)

   await studio.scrollTo(0)
   studio.speak('all-cash')
   await studio.spot(portfolioTitle, 6)
   await studio.pause(2600)
   await studio.spot(page.locator('[data-slot="card"]').first().getByText('Largest drift').locator('..'), 6)
   await studio.quiet()
   await studio.spot(null)

   studio.speak('preview')
   await studio.click(cardButton('Rebalance'), { settle: 1200 })
   await blurFocus()
   await studio.spot(dialog.locator('table'), 6)
   await studio.hover(dialog.locator('table tbody tr').nth(2))
   await studio.quiet()
   await studio.spot(null)

   await studio.click(footerButton('Place 5 orders'), { settle: 300 })
   studio.speak('confirm')
   await studio.spot(confirmDialog, 4)
   await studio.quiet()
   await studio.spot(null)
   await studio.click(confirmDialog.getByRole('button', { name: 'Place the orders' }), { settle: 200 })
   studio.speak('sending')
   await dialog.getByText('5 of 5 orders settled').waitFor({ timeout: 30000 })
   await studio.quiet()
   await studio.pause(300)
   await studio.click(footerButton('Close'), { settle: 800 })

   studio.speak('on-target')
   await studio.spotColumn(holdingsTable, 'Target', 'Drift')
   await studio.pause(3600)
   await studio.spotColumn(holdingsTable, 'Unrealized', 'Realized')
   await studio.quiet()
   await studio.spot(null)

   await studio.scrollTo(0)
   studio.speak('add-cash')
   await studio.click(cardButton('Deposit'), { settle: 700 })
   await studio.click(page.locator('#deposit-amount'), { settle: 150 })
   await studio.type('1000')
   await studio.pause(400)
   await studio.click(footerButton('Deposit'), { settle: 1200 })
   await studio.spot(holdingsTable.locator('tr', { hasText: 'cash' }), 4)
   await studio.quiet()
   await studio.spot(null)

   await studio.scrollTo(0)
   studio.speak('withdraw')
   await studio.click(cardButton('Withdraw'), { settle: 700 })
   await studio.click(page.locator('#withdraw-amount'), { settle: 150 })
   await studio.type('1500')
   await studio.spot(dialog.locator('[data-slot="dialog-description"]'), 6)
   await studio.quiet()
   await studio.spot(null)
   await studio.click(footerButton('Preview'), { settle: 1100 })
   await blurFocus()

   studio.speak('withdraw-plan')
   await studio.spotColumn(dialog.locator('table'), 'About')
   await studio.pause(2600)
   await studio.spot(dialog.locator('table'), 6)
   await studio.quiet()
   await studio.spot(null)
   await studio.click(footerButton('Place 5 orders'), { settle: 600 })
   await studio.click(confirmDialog.getByRole('button', { name: 'Place the orders' }), { settle: 300 })

   await dialog.getByText(/2 of 5 orders settled/).waitFor({ timeout: 30000 })
   studio.speak('withdrawn')
   await dialog.getByText(/1,500.00 USDT of 1,500.00 USDT withdrawn/).waitFor({ timeout: 30000 })
   await studio.pause(500)
   await studio.click(footerButton('Close'), { settle: 900 })
   await studio.spot(accountCash, 4)
   await studio.quiet()
   await studio.pause(900)
   await studio.spot(null)

   await studio.scrollTo(0)
   await studio.card(laterCard)
   studio.speak('later')
   await page.evaluate(moves => {
      window.__video.movePrices(moves)
      window.__video.advanceDays(21)
   }, moves)
   await studio.pause(1800)
   await studio.card(null)
   await studio.click(page.getByRole('button', { name: 'Refresh' }), { settle: 1200 })
   await studio.quiet()

   studio.speak('drift')
   await studio.spotColumn(holdingsTable, 'Drift')
   await studio.pause(2600)
   await studio.spot(portfolioTitle, 6)
   await studio.quiet()
   await studio.spot(null)

   await studio.scrollTo(0)
   studio.speak('rebalance-plan')
   await studio.click(cardButton('Rebalance'), { settle: 1200 })
   await blurFocus()
   await studio.spot(dialog.locator('table'), 6)
   await studio.pause(3000)
   await studio.spot(dialog.getByText(/NEAR left alone/), 6)
   await studio.quiet()
   await studio.spot(null)

   await studio.click(dialog.locator('[data-slot="dialog-footer"] button', { hasText: /^Place \d+ orders$/ }), { settle: 600 })
   await studio.click(confirmDialog.getByRole('button', { name: 'Place the orders' }), { settle: 200 })
   studio.speak('sells-first')
   await dialog.getByText(/(\d+) of \1 orders settled/).waitFor({ timeout: 30000 })
   await studio.quiet()
   await studio.click(footerButton('Close'), { settle: 800 })

   studio.speak('realized')
   await studio.spotColumn(holdingsTable, 'Realized')
   await studio.quiet()
   await studio.spot(null)

   await studio.scrollTo(0)
   studio.speak('history')
   await studio.click(page.getByRole('button', { name: 'History' }), { settle: 1000 })
   await studio.pause(1000)
   await dialog.evaluate(element => new Promise<void>(resolve => {
      const from = element.scrollTop
      const to = element.scrollHeight - element.clientHeight
      const start = performance.now()
      const step = (now: number) => {
         const t = Math.min(1, (now - start) / 2600)
         element.scrollTop = from + (to - from) * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
         if (t < 1) requestAnimationFrame(step)
         else resolve()
      }
      requestAnimationFrame(step)
   }))
   await studio.quiet()
   await page.keyboard.press('Escape')
   await studio.pause(700)

   studio.speak('outro')
   await studio.spot(page.getByRole('tab', { name: 'Demo' }), 4)
   await studio.click(page.getByRole('tab', { name: 'Demo' }), { settle: 800 })
   await studio.spot(null)
   await studio.quiet()
   await studio.card(endCard)
   await studio.pause(3200)
}
