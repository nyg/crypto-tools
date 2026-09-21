import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleTheme, useTheme } from '@/lib/theme'

export default function ThemeToggle() {

   const theme = useTheme()
   const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

   return (
      <Button
         variant="ghost"
         size="icon-sm"
         className="text-muted-foreground hover:text-foreground"
         aria-label={label}
         title={label}
         onClick={toggleTheme}>
         {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
      </Button>
   )
}
