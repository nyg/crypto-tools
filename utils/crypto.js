function hmac(hashAlgo) {

   return async (keyString, message, digest = 'hex') => {

      const key = await crypto.subtle.importKey(
         'raw',
         new TextEncoder().encode(keyString),
         { name: 'HMAC', hash: hashAlgo },
         false,
         ['sign'])

      const signature = await crypto.subtle.sign(
         'HMAC',
         key,
         new TextEncoder().encode(message))

      switch (digest) {
         case 'hex':
            return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('')
         case 'base64':
            return btoa(String.fromCharCode(...new Uint8Array(signature)))
         default:
            return signature
      }
   }
}

export const hmac256 = hmac('SHA-256')
