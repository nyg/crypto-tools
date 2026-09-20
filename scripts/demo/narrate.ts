import { $ } from 'bun'
import { mkdirSync } from 'fs'
import type { Segment } from './studio'

export interface NarrateOptions {
   videoDir: string
   audioDir: string
   voice?: string
   speed?: string
   python?: string
}

type DraftSegment = Omit<Segment, 'duration'> & { duration?: number }

export const defaultPython = () => process.env.DEMO_PYTHON ?? `${process.env.HOME}/.cache/crypto-tools/kokoro-venv/bin/python`

export async function narrate(options: NarrateOptions): Promise<Segment[]> {

   const { videoDir, audioDir } = options
   const voice = options.voice ?? process.env.KOKORO_VOICE ?? 'af_heart'
   const speed = options.speed ?? process.env.KOKORO_SPEED ?? '1.0'
   const python = options.python ?? defaultPython()
   const raw = `${audioDir}/raw`

   if (!await Bun.file(python).exists()) {
      throw new Error(`no Kokoro python at ${python}: run scripts/demo/setup-tts.sh, or set DEMO_PYTHON`)
   }

   mkdirSync(audioDir, { recursive: true })
   const segments: DraftSegment[] = await Bun.file(`${videoDir}/narration.json`).json()

   await $`${python} ${import.meta.dir}/render-narration.py ${videoDir}/narration.json ${raw}`
      .env({ ...process.env, KOKORO_VOICE: voice, KOKORO_SPEED: speed })
      .quiet()

   for (const segment of segments) {
      const wav = `${audioDir}/${segment.id}.wav`
      const trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=60:all=1,apad=pad_dur=0.12'
      await $`ffmpeg -y -loglevel error -i ${raw}/${segment.id}.wav -af ${trim} -ar 48000 -ac 1 ${wav}`
      const probed = await $`ffprobe -v error -show_entries format=duration -of csv=p=0 ${wav}`.text()
      segment.duration = Number(probed.trim())
      console.log(`  ${segment.id.padEnd(16)} ${segment.duration.toFixed(2)} s`)
   }

   const timed = segments as Segment[]
   await Bun.write(`${audioDir}/segments.json`, JSON.stringify(timed, null, 3))
   console.log(`voice ${voice}, ${timed.reduce((sum, { duration }) => sum + duration, 0).toFixed(1)} s of narration`)
   return timed
}

export async function loadSegments(audioDir: string): Promise<Segment[]> {
   const file = Bun.file(`${audioDir}/segments.json`)
   if (!await file.exists()) throw new Error(`no narration rendered yet in ${audioDir}`)
   return file.json()
}
