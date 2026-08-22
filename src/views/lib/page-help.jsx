import { Link } from 'react-router'
import ExternalLink from '../components/lib/external-link'

// What each page is and where its data comes from, keyed by route. Kept in one place
// and out of the pages themselves: the copy is worth having, a banner above every
// page is not, and whichever surface ends up showing it should have a single list to
// read from rather than ten paragraphs scattered across the routes.
const pageHelp = {

   '/settings':
      <>
         The keys the other pages use to reach each exchange. They are stored on this machine
         in the app&apos;s own data folder, beside the ledger database, never uploaded
         anywhere, and used only to sign the calls a page makes on your behalf. Removing a key
         here is enough to cut a page off from its exchange.
      </>,

   '/kraken/ledger':
      <>
         Downloads two exports from Kraken — your complete ledger and your trade history —
         and keeps both in a database on this machine, so the other tools can use them
         without querying the API again. Kraken prepares each export in the background, so
         a first sync can take several minutes. Nothing is uploaded anywhere.
      </>,

   '/kraken/balances':
      <>
         What you hold, rebuilt from the local database the Ledger tab fills, and
         grouped by <b>where each coin actually sits</b> — your spot wallet, or one
         of Kraken&apos;s Earn strategies. Coins left in spot that are still being
         paid are marked <b>Opt-In Rewards</b>, since they keep earning without
         leaving the wallet they can be traded from. Totals are checked against
         Kraken live, which also says how much an open order has already reserved.
      </>,

   '/kraken/rewards':
      <>
         Everything Kraken has paid you for staking and earning, per asset and per
         year, read from the local database the Ledger tab fills. Moving coins in and
         out of an earn position is not income and is left out. Each amount is valued
         at today&apos;s market price, so the USD figures move with the market.
      </>,

   '/kraken/fees':
      <>
         Everything Kraken has charged you since the account was opened — mostly trade
         fees, but also withdrawal fees and anything else the ledger records — read from
         the local database the Ledger tab fills. Fees are totalled in the asset they were
         charged in, and converted at today&apos;s rate for the USD column and the share.
      </>,

   '/kraken/aggregated-trades':
      <>
         Your trades for one asset, grouped into runs of buys and sells.
      </>,

   '/kraken/open-orders':
      <>
         Orders still on Kraken&apos;s book, read live and grouped by trading pair. Cancel one
         or several at once; new ones are created on{' '}
         <Link to="/kraken/order-batch" className="underline underline-offset-4">Order Batch</Link>.
      </>,

   '/kraken/order-batch':
      <>
         Create a series of limit orders on one pair in a single go. Orders are{' '}
         <ExternalLink href="https://support.kraken.com/hc/en-us/articles/203053246-Other-order-options" className="underline">
            post limit orders
         </ExternalLink>, fees are taken in the quote currency, and orders are sent 15 at a time
         (Kraken API limit). Kraken allows between{' '}
         <ExternalLink href="https://support.kraken.com/hc/en-us/articles/209090607-Maximum-number-of-open-orders" className="underline">
            80 and 225 open orders
         </ExternalLink> across all pairs, depending on your verification level.
      </>,

   '/kraken/xstocks':
      <>
         Kraken&apos;s tokenized stocks and ETFs. Which listings are stocks and which are ETFs
         comes from a reference list shipped with the app, so it loads instantly and costs
         nothing. Descriptions are written by Claude only when you ask for them, billed to your
         Anthropic account, and cached afterwards.
      </>,

   '/binance/staking':
      <>
         Your spot and staking balances, read live from Binance each time you ask for
         them — unlike the Kraken pages there is no local database behind this one, so
         nothing is shown until you fetch. Locked staking positions are listed with the
         date each one is released and the products they were subscribed to.
      </>,

   '/tools/trade-calculator':
      <>
         Turns the loss you are prepared to take into a position size: risk amount over the
         distance from entry to stop loss. From there it lays out the take profit tiers as
         multiples of that same risk, with the profit and return each one realises. It reaches
         no exchange and knows nothing about your account — every number comes from what you
         type, and only the form is kept, on this machine. The chart beside it is an embedded{' '}
         <ExternalLink href="https://www.tradingview.com/" className="underline">TradingView</ExternalLink>{' '}
         widget, the one part of the page that talks to the network.
      </>
}

export default pageHelp
