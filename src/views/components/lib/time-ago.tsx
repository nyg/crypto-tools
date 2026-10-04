import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

const TICK_MS = 30_000

export default function TimeAgo({ time }: { time: number | Date }) {

   const [, setTick] = useState(0)

   useEffect(() => {
      const timer = setInterval(() => setTick(tick => tick + 1), TICK_MS)
      return () => clearInterval(timer)
   }, [])

   return <>{formatDistanceToNow(time)} ago</>
}
