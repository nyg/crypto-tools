/// <reference types="bun-types" />
import concurrently from 'concurrently'

const DEFAULT_VITE_PORT = 3000
const DEFAULT_API_PORT = 3001

// Asked over HTTP rather than by binding: Vite listens on whichever address
// `localhost` resolves to, so a bind on the other one would call a taken port free.
const isAnswering = (url: string) =>
   fetch(url, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false)

function unusedPort(): number {
   const probe = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() })
   const { port } = probe
   void probe.stop(true)
   if (port === undefined) throw new Error('The system handed out no free port.')
   return port
}

const portFor = async (variable: string, host: string, preferred: number) =>
   process.env[variable] ?? String(await isAnswering(`http://${host}:${preferred}`) ? unusedPort() : preferred)

const env = {
   VITE_PORT: await portFor('VITE_PORT', 'localhost', DEFAULT_VITE_PORT),
   PORT: await portFor('PORT', '127.0.0.1', DEFAULT_API_PORT)
}

const { result } = concurrently([
   { command: 'vite', name: 'vite', prefixColor: 'cyan', env },
   { command: 'bun --watch src/server/index.ts', name: 'bun', prefixColor: 'magenta', env }
])

await result.catch(() => process.exit(1))
