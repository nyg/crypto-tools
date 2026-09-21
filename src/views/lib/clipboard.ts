function copyThroughSelection(text: string): boolean {

   const textarea = document.createElement('textarea')
   textarea.value = text
   textarea.setAttribute('readonly', '')
   textarea.style.position = 'fixed'
   textarea.style.opacity = '0'
   document.body.appendChild(textarea)
   textarea.select()

   try {
      return document.execCommand('copy')
   }
   catch {
      return false
   }
   finally {
      textarea.remove()
   }
}

export async function copyText(text: string): Promise<boolean> {

   try {
      await navigator.clipboard.writeText(text)
      return true
   }
   catch {
      return copyThroughSelection(text)
   }
}
