// A trading pair as both exchanges describe it, once their own naming has been
// normalized away. RateFinder walks these to price an asset against USDT, so the
// shape has to be the same whichever exchange produced it.

export interface TradingPairSide {
   name: string
   decimals: number
}

export interface TradingPair {
   id: string
   name: string
   base: TradingPairSide
   quote: TradingPairSide
}

export type TradingPairs = Record<string, TradingPair>
