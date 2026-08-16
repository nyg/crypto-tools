import { FFIType, dlopen, ptr, read as readMemory, toArrayBuffer } from 'bun:ffi'

const CRED_TYPE_GENERIC = 1
const CRED_PERSIST_LOCAL_MACHINE = 2
const ERROR_NOT_FOUND = 1168

const CREDENTIAL_SIZE = 80
const OFFSET_TYPE = 4
const OFFSET_TARGET_NAME = 8
const OFFSET_BLOB_SIZE = 32
const OFFSET_BLOB = 40
const OFFSET_PERSIST = 48
const OFFSET_USER_NAME = 72

const advapi32 = dlopen('advapi32.dll', {
   CredWriteW: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.bool },
   CredReadW: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr], returns: FFIType.bool },
   CredDeleteW: { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.bool },
   CredFree: { args: [FFIType.ptr], returns: FFIType.void }
})

const kernel32 = dlopen('kernel32.dll', {
   GetLastError: { args: [], returns: FFIType.u32 },
   SetLastError: { args: [FFIType.u32], returns: FFIType.void }
})

const PROBE_NAME = 'availability-probe'

const attempt = action => {
   try {
      return action()
   }
   catch {
      return false
   }
}

const wide = text => {
   const units = new Uint16Array(text.length + 1)
   for (let index = 0; index < text.length; index++) units[index] = text.charCodeAt(index)
   units[text.length] = 0
   return units
}

const utf16Bytes = text => {
   const bytes = new Uint8Array(text.length * 2)
   const view = new DataView(bytes.buffer)
   for (let index = 0; index < text.length; index++) view.setUint16(index * 2, text.charCodeAt(index), true)
   return bytes
}

const fromUtf16 = (buffer, byteLength) => {
   const view = new DataView(buffer)
   let text = ''
   for (let offset = 0; offset + 1 < byteLength; offset += 2) text += String.fromCharCode(view.getUint16(offset, true))
   return text
}

export default function windowsStore(service) {

   const targetFor = name => wide(`${service}/${name}`)

   const attemptRead = name => {
      const target = targetFor(name)
      const out = new BigUint64Array(1)

      kernel32.symbols.SetLastError(0)
      if (!advapi32.symbols.CredReadW(ptr(target), CRED_TYPE_GENERIC, 0, ptr(out))) {
         return { found: false, code: kernel32.symbols.GetLastError() }
      }

      const credential = Number(out[0])
      try {
         const size = readMemory.u32(credential, OFFSET_BLOB_SIZE)
         const blob = readMemory.ptr(credential, OFFSET_BLOB)
         return { found: true, value: !blob || size === 0 ? '' : fromUtf16(toArrayBuffer(blob, 0, size), size) }
      }
      finally {
         advapi32.symbols.CredFree(credential)
      }
   }

   const readCredential = name => {
      const { found, value, code } = attemptRead(name)
      if (found) return value
      if (code === ERROR_NOT_FOUND || code === 0) return null
      throw new Error(`CredReadW failed with ${code} for ${name}`)
   }

   const writeCredential = (name, value) => {
      const target = targetFor(name)
      const user = wide(name)
      const blob = utf16Bytes(value)

      const credential = new Uint8Array(CREDENTIAL_SIZE)
      const view = new DataView(credential.buffer)

      view.setUint32(OFFSET_TYPE, CRED_TYPE_GENERIC, true)
      view.setBigUint64(OFFSET_TARGET_NAME, BigInt(ptr(target)), true)
      view.setUint32(OFFSET_BLOB_SIZE, blob.byteLength, true)
      view.setBigUint64(OFFSET_BLOB, BigInt(blob.byteLength ? ptr(blob) : 0), true)
      view.setUint32(OFFSET_PERSIST, CRED_PERSIST_LOCAL_MACHINE, true)
      view.setBigUint64(OFFSET_USER_NAME, BigInt(ptr(user)), true)

      if (!advapi32.symbols.CredWriteW(ptr(credential), 0)) return false

      const written = attemptRead(name)
      return written.found && written.value === value
   }

   const removeCredential = name => {
      const target = targetFor(name)
      if (advapi32.symbols.CredDeleteW(ptr(target), CRED_TYPE_GENERIC, 0)) return true
      return !attemptRead(name).found
   }

   return {
      id: 'credential-manager',

      available() {
         const usable = attempt(() => writeCredential(PROBE_NAME, PROBE_NAME))
         attempt(() => removeCredential(PROBE_NAME))
         return usable === true
      },

      read: readCredential,
      write: writeCredential,
      remove: removeCredential
   }
}
