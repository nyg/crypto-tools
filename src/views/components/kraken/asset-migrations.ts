// Assets Kraken has migrated to a new ticker, leaving the old balance stranded.
export interface AssetMigration {
   to: string
   ratio: number
   on: string
   credited: string
}

export const assetMigrations: Record<string, AssetMigration> = {
   AI16Z: { to: 'ELIZAOS', ratio: 6, on: '2025-12-19', credited: 'an airdrop' }
}

// Assets Kraken renamed, keeping the balance: the history before the rename is still
// under the old ticker. The server's renamedAssets, in
// src/server/adapters/kraken-api/assets.ts, is this table the other way round.
const formerTickers: Record<string, string[]> = {
   POL: ['MATIC']
}

export const assetLabel = (asset: string): string => {
   const former = formerTickers[asset]
   return former ? `${asset} (ex. ${former.join(', ')})` : asset
}

export const migrationOf = (asset: string): AssetMigration | null => assetMigrations[asset] ?? null

export const migrationNote = (asset: string): string | null => {

   const migration = migrationOf(asset)
   if (!migration) return null

   return `Migrated to ${migration.to} on ${migration.on} at 1:${migration.ratio}, credited as ${migration.credited}.`
      + ' Kraken credits the new asset and leaves this balance behind; it has no tradable pair, so it cannot be valued or sold.'
}
