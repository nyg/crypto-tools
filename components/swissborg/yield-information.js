import { Fragment } from 'react'
import * as format from '@/utils/format'


const announcements = [
   { asset: 'USDC', url: 'swissborg-launches-usdc-smart-yield', date: new Date(2020, 11, 14) },
   { asset: 'CHSB', url: 'chsb-smart-yield', date: new Date(2021, 0, 29) },
   { asset: 'ETH', url: 'eth-smart-yield', date: new Date(2021, 2, 19) },
   { asset: 'BTC', url: 'btc-smart-yield', date: new Date(2021, 4, 6) },
   { asset: 'BNB', url: 'bnb-smart-yield', date: new Date(2021, 5, 4) },
   { asset: 'USDT', url: 'usdt-smart-yield', date: new Date(2021, 5, 25) },
   { asset: 'XRP', url: 'xrp-smart-yield', date: new Date(2021, 6, 2) },
   { asset: 'MATIC', url: 'polygon-smart-yield', date: new Date(2021, 8, 2) },
   { asset: 'EURT', url: 'yield-on-eurt', date: new Date(2021, 9, 15) },
]

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long' })
const monthString = date => monthFormat.format(date).toLowerCase()

const monthRange = () => {
   const dateFrom = new Date(2021, 0)
   const dateTo = new Date(2022, 8)
   const monthCount = dateTo.getMonth() - dateFrom.getMonth() + 12 * (dateTo.getFullYear() - dateFrom.getFullYear())
   return [...Array(monthCount).keys()]
}

const reports = index => {
   const year = 2021 + Math.floor(index / 12)
   const month = index % 12
   const date = new Date(year, month)

   return index == 0
      ? { url: 'smart-yield-report-december-2020-january-2021', date }
      : { url: `smart-yield-report-${monthString(date)}-${year}`, date }
}

const separator = (index, array) => index < array.length - 1 && <span> • </span>

export default function YieldInformation({ className }) {
   return (
      <div className={`${className} space-y-4 text-sm text-muted-foreground`}>
         <p>
            <span className="font-medium text-foreground mr-3">First announcements</span>
            {announcements.map(({ asset, url, date }, index, array) => (
               <Fragment key={index}>
                  <a href={`https://swissborg.com/blog/${url}`}
                     target="_blank" rel="noreferrer"
                     className="text-foreground underline hover:text-muted-foreground">
                     {asset}
                  </a>
                  <small suppressHydrationWarning> {format.asLongDate(date)}</small>
                  {separator(index, array)}
               </Fragment>
            ))}
         </p>
         <p>
            <span className="font-medium text-foreground mr-3">Smart Yield Reports</span>
            {monthRange().map(reports).map(({ url, date }, index, array) => (
               <Fragment key={index}>
                  <a href={`https://swissborg.com/blog/${url}`}
                     target="_blank" rel="noreferrer"
                     className="text-foreground underline hover:text-muted-foreground"
                     suppressHydrationWarning>
                     {format.asShortMonthYearDate(date)}
                  </a>
                  {separator(index, array)}
               </Fragment>
            ))}
         </p>
      </div>
   )
}
