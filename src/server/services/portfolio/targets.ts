import Big from 'big.js'

export interface TargetWeight {
   asset: string
   weight: string
}

export class TargetError extends Error {
   constructor(message: string) {
      super(message)
      this.name = 'TargetError'
   }
}

const assetPattern = /^[A-Z0-9]{1,20}$/

function parseWeight(asset: string, weight: unknown): Big {
   try {
      const parsed = Big(String(weight).trim())
      if (parsed.lte(0) || parsed.gt(100)) throw new TargetError(`${asset} needs a weight above 0 and at most 100.`)
      return parsed
   }
   catch (error) {
      if (error instanceof TargetError) throw error
      throw new TargetError(`${asset} has a weight that is not a number.`)
   }
}

export function validateTargets(targets: unknown, quote: string, tradable: Set<string>): TargetWeight[] {

   if (!Array.isArray(targets) || targets.length === 0) throw new TargetError('Add at least one asset.')

   const seen = new Set<string>()
   let sum = Big(0)

   const validated = targets.map((target: unknown) => {
      const { asset: rawAsset, weight } = (target ?? {}) as { asset?: unknown, weight?: unknown }
      const asset = String(rawAsset ?? '').trim().toUpperCase()

      if (!assetPattern.test(asset)) throw new TargetError(`"${asset}" is not an asset symbol.`)
      if (seen.has(asset)) throw new TargetError(`${asset} is listed twice.`)
      if (asset !== quote && !tradable.has(asset)) throw new TargetError(`${asset} has no spot market against ${quote}.`)

      seen.add(asset)
      const parsed = parseWeight(asset, weight)
      sum = sum.plus(parsed)
      return { asset, weight: parsed.toFixed() }
   })

   if (!sum.eq(100)) throw new TargetError(`The weights add up to ${sum.toFixed()}%, not 100%.`)
   return validated
}
