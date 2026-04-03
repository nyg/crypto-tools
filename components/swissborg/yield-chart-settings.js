import { useState, useEffect } from 'react'
import Select from '@/components/lib/select'


const getPreference = (key, defaultValue) => {
   if (typeof window === 'undefined') return defaultValue
   return localStorage.getItem(`swissborg.${key}`) ?? defaultValue
}

const setPreference = (key, value) => {
   localStorage.setItem(`swissborg.${key}`, value)
}

export default function YieldChartSettings({ onChange }) {

   const [lineType, setLineType] = useState(() => getPreference('lineType', 'monotone'))
   const [yieldRate, setYieldRate] = useState(() => getPreference('yieldRate', 'genesis'))
   const [timeFrame, setTimeFrame] = useState(() => getPreference('timeFrame', '90'))

   useEffect(() => {
      onChange?.({ lineType, yieldRate, timeFrame })
   }, [lineType, yieldRate, timeFrame])

   const update = (setter, key) => e => {
      const value = e.target.value
      setter(value)
      setPreference(key, value)
   }

   return (
      <div className="flex justify-center gap-4">
         <Select name="yield-rate" label="Yield rate" value={yieldRate} onChange={update(setYieldRate, 'yieldRate')}>
            <option value="genesis">Genesis & Generation</option>
            <option value="pioneer">Pioneer</option>
            <option value="community">Community</option>
            <option value="explorer">Explorer</option>
            <option value="standard">Standard</option>
         </Select>
         <Select name="line-type" label="Line type" value={lineType} onChange={update(setLineType, 'lineType')}>
            <option value="monotone">Monotone</option>
            <option value="linear">Linear</option>
            <option value="step">Step</option>
            <option value="stepAfter">Step After</option>
         </Select>
         <Select name="time-frame" label="Time frame" value={timeFrame} onChange={update(setTimeFrame, 'timeFrame')}>
            <option value="7">1 week</option>
            <option value="14">2 weeks</option>
            <option value="30">1 month</option>
            <option value="90">3 months</option>
            <option value="180">6 months</option>
            <option value="365">1 year</option>
            <option value="all">All</option>
         </Select>
      </div>
   )
}
