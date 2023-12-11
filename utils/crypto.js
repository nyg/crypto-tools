function hash(hashAlgo) {

   return async message => {
      const digest = await crypto.subtle.digest(hashAlgo, new TextEncoder().encode(message))
      return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
   }
}

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

export const sha256 = hash('SHA-256')

export const hmacSha256 = hmac('SHA-256')
export const hmacSha512 = hmac('SHA-512')
