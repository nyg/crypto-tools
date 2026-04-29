import postgres from 'postgres'

const pgSql = process.env.POSTGRES_URL ? postgres(process.env.POSTGRES_URL) : null

export { pgSql }
