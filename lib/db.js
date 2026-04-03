import postgres from 'postgres'

const pgSql = postgres(process.env.POSTGRES_URL)

export { pgSql }
