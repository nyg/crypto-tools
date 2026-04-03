import { pgSql } from '@/lib/db'

const numberOfDays = timeFrame => {
   const days = parseInt(timeFrame)
   return isFinite(days) ? days : 100 * 365
}

const findYieldsSince = async since =>
   await pgSql`
   select y.date, y.value, s.name
     from yields y
    inner join earn_strategies s on y.earn_strategy = s.id
    where s.active = true
      and y.date > ${since}`

export default async function getYield(req, res) {
   const xAxisTicks = []
   const allAssets = new Set()
   const maxDays = numberOfDays(req.query.timeFrame)

   const startDate = new Date()
   startDate.setDate(startDate.getDate() - maxDays)

   const yieldsByDate = (await findYieldsSince(startDate))
      .reduce((yields, _yield) => {
         yields[_yield.date] ??= { date: _yield.date }
         yields[_yield.date][_yield.name] = _yield.value
         return yields
      }, {})

   const yields = Object
      .values(yieldsByDate)
      .map(_yield => {
         const date = new Date(_yield.date)
         Object.keys(_yield).filter(k => k != 'date').forEach(asset => allAssets.add(asset))
         _yield.date = date.getTime()
         if (date.getDate() == 1 || date.getDate() == 15) {
            xAxisTicks.push(_yield.date)
         }
         return _yield
      })

   res.status(200).json({
      yields,
      xTicks: xAxisTicks,
      assets: [...allAssets].sort()
   })
}
