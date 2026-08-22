export const assetMigrations = {
   AI16Z: { to: 'ELIZAOS', ratio: 6, on: '2025-12-19', credited: 'an airdrop' }
}

export const migrationOf = asset => assetMigrations[asset] ?? null

export const migrationNote = (asset) => {

   const migration = migrationOf(asset)
   if (!migration) return null

   return `Migrated to ${migration.to} on ${migration.on} at 1:${migration.ratio}, credited as ${migration.credited}.`
      + ' Kraken credits the new asset and leaves this balance behind; it has no tradable pair, so it cannot be valued or sold.'
}
