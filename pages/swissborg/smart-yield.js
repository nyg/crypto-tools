import { useState } from 'react'
import SwissBorgLayout from '@/components/swissborg/swissborg-layout'
import YieldChartSettings from '@/components/swissborg/yield-chart-settings'
import YieldChart from '@/components/swissborg/yield-chart'
import YieldInformation from '@/components/swissborg/yield-information'
import YieldAverages from '@/components/swissborg/yield-averages'


export default function SmartYield() {

   const [settings, setSettings] = useState({})

   return (
      <SwissBorgLayout name="Smart Yield">
         <div className="space-y-8">
            <YieldChartSettings onChange={setSettings} />
            <YieldChart settings={settings} />
            <YieldInformation />
            <YieldAverages yieldRate={settings.yieldRate} />
         </div>
      </SwissBorgLayout>
   )
}
