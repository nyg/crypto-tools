import { useState } from 'react'
import SwissBorgLayout from '@/components/swissborg/swissborg-layout'
import YieldChartSettings from '@/components/swissborg/yield-chart-settings'
import YieldChart from '@/components/swissborg/yield-chart'
import YieldAverages from '@/components/swissborg/yield-averages'


export default function SmartYield() {

   const [settings, setSettings] = useState({})
   const [visibility, setVisibility] = useState({})

   return (
      <SwissBorgLayout name="Smart Yield">
         <div className="space-y-8">
            <YieldChartSettings onChange={setSettings} />
            <YieldChart settings={settings} onVisibilityChange={setVisibility} />
            <YieldAverages yieldRate={settings.yieldRate} visibility={visibility} />
         </div>
      </SwissBorgLayout>
   )
}
