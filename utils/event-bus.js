// `document' does not exist during Next.js' SSR
const target = typeof document === 'undefined' ? undefined : document

const eventBus = {

   on(event, callback) {
      const effectiveCallback = event => callback(event.detail)
      target?.addEventListener(event, effectiveCallback)
      // helper for React's useEffect
      return () => this.remove(event, effectiveCallback)
   },

   remove(event, callback) {
      target?.removeEventListener(event, callback)
   },

   dispatch(event, data) {
      target?.dispatchEvent(new CustomEvent(event, { detail: data }))
   }
}

export default eventBus
