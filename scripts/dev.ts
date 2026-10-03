/// <reference types="bun-types" />
import concurrently from 'concurrently'

// Picked here rather than by the server binding port 0 itself: Vite needs the port for
// its proxy before the server is up, and `bun --watch` has to come back on the same one.
function unusedPort(): string {
   const probe = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() })
   const { port } = probe
   void probe.stop(true)
   if (port === undefined) throw new Error('The system handed out no free port.')
   return String(port)
}

const env = { PORT: process.env.PORT || unusedPort() }

// A server that lost its port must take Vite down with it, or Vite goes on proxying
// /api to whichever process holds the port.
const { result } = concurrently([
   { command: 'vite', name: 'vite', prefixColor: 'cyan', env },
   { command: 'bun --watch src/server/index.ts', name: 'bun', prefixColor: 'magenta', env }
], { killOthersOn: ['failure'] })

await result.catch(() => process.exit(1))
