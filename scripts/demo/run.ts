import { mkdirSync } from 'fs'
import { encode } from './encode'
import { loadSegments, narrate } from './narrate'
import { Studio } from './studio'
import type { Segment } from './studio'

export interface Scene {
   (studio: Studio): Promise<void>
}

const WIDTH = 1280
const HEIGHT = 720
const SCALE = 1.5

const args = process.argv.slice(2)
const video = args.find(argument => !argument.startsWith('--'))
const flag = (name: string) => args.includes(`--${name}`)
const option = (name: string) => args.find(argument => argument.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

if (!video) {
   console.error('usage: bun scripts/demo/run.ts <video> [--narrate] [--encode-only] [--out=path.mp4]')
   process.exit(1)
}

const root = import.meta.dir
const videoDir = `${root}/videos/${video}`
const workDir = `${root}/.work/${video}`
const audioDir = `${workDir}/audio`
const outDir = `${root}/.out`
const out = option('out') ?? `${outDir}/${video}.mp4`
const port = Number(process.env.DEMO_PORT ?? 3100)

mkdirSync(workDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

const hasNarration = await Bun.file(`${audioDir}/segments.json`).exists()
const segments: Segment[] = flag('narrate') || !hasNarration
   ? await narrate({ videoDir, audioDir })
   : await loadSegments(audioDir)

if (!flag('encode-only')) {
   const server = Bun.spawn(['./node_modules/.bin/vite', '--config', 'scripts/demo/vite.config.ts'], {
      cwd: `${root}/../..`,
      env: { ...process.env, VITE_MOCK_DATA: 'true', DEMO_VIDEO: video, DEMO_PORT: String(port) },
      stdout: 'ignore',
      stderr: 'inherit'
   })

   try {
      await waitForServer(port)
      const studio = new Studio({
         url: `http://localhost:${port}${option('path') ?? '/'}`,
         width: WIDTH,
         height: HEIGHT,
         scale: SCALE,
         workDir,
         segments
      })

      const { default: scene } = await import(`${videoDir}/scene.ts`) as { default: Scene }
      await studio.open()
      await scene(studio)
      await studio.stopCapture(`${workDir}/capture.json`)
      await studio.close()
   }
   finally {
      server.kill()
   }
}

await encode({ workDir, audioDir, segments, out, title: video })

async function waitForServer(port: number) {
   for (let attempt = 0; attempt < 60; attempt++) {
      try {
         await fetch(`http://localhost:${port}/`)
         return
      }
      catch {
         await new Promise(resolve => setTimeout(resolve, 500))
      }
   }
   throw new Error(`the demo server never came up on port ${port}`)
}
