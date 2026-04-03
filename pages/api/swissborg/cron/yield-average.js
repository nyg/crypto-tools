import { pgSql } from '@/lib/db'

const forEachKeyOf = (object, fn) => Object.keys(object).forEach(fn)

export default async function updateYieldAverages(req, res) {
   if (req.method !== 'POST') {
      res.status(405).json({ message: 'Only POST requests allowed' })
      return
   }

   const strategies = await pgSql`select id, name from earn_strategies`
   const strategyIdByName = strategies.reduce((map, strategy) => {
      map[strategy.name] = strategy.id
      return map
   }, {})

   const yields = await pgSql`
      select y.date, y.value, s.name
        from yields y
       inner join earn_strategies s on y.earn_strategy = s.id`

   const groupedYields = yields.reduce((groupedYields, _yield) => {
      const month = _yield.date.toISOString().substring(0, 7)
      groupedYields[month] ??= {}
      groupedYields[month][_yield.name] ??= []
      groupedYields[month][_yield.name].push({ date: _yield.date, value: _yield.value })
      return groupedYields
   }, {})

   const initialBalance = 1

   forEachKeyOf(groupedYields, month => {
      const year = parseInt(month.substring(0, 4))
      const isLeapYear = !(year & 3 || !(year % 25) && year & 15)
      const periodCount = isLeapYear ? 366 : 365

      forEachKeyOf(groupedYields[month], strategy => {
         groupedYields[month][strategy] = groupedYields[month][strategy]
            .reduce((acc, _yield) => {
               const apr = periodCount * (Math.pow(_yield.value / 100 + 1, 1 / periodCount) - 1)
               const dailyInterest = apr * acc.finalBalance / periodCount
               acc.finalBalance += dailyInterest
               acc.dayCount++
               return acc
            }, { finalBalance: initialBalance, dayCount: 0 })

         const { finalBalance, dayCount } = groupedYields[month][strategy]
         const apr = periodCount * (Math.pow(finalBalance / initialBalance, 1 / dayCount) - 1)
         const apy = Math.pow(apr / periodCount + 1, periodCount) - 1

         groupedYields[month][strategy] = apy
      })
   })

   await pgSql`delete from yield_averages`

   const yieldAverages = Object
      .keys(groupedYields)
      .flatMap(month => Object
         .keys(groupedYields[month])
         .map(strategy => ({
            'earn_strategy': strategyIdByName[strategy],
            date: month,
            value: groupedYields[month][strategy]
         })))

   await pgSql`insert into yield_averages ${pgSql(yieldAverages)}`

   res.status(200).json({ status: 'success' })
}
