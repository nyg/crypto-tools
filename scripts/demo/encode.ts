import { $ } from 'bun'
import type { Capture, Segment } from './studio'

export interface EncodeOptions {
   workDir: string
   audioDir: string
   segments: Segment[]
   out: string
   fps?: number
   maxSpeed?: number
   title?: string
}

interface Region {
   a: number
   b: number
   k: number
}

const stamp = (seconds: number) => {
   const ms = Math.max(0, Math.round(seconds * 1000))
   const pad = (value: number, size = 2) => String(value).padStart(size, '0')
   return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`
}

function fastForwardRegions(capture: Capture, maxSpeed: number): Region[] {
   const regions: Region[] = []
   for (const [index, current] of capture.spoken.entries()) {
      const next = capture.spoken[index + 1]
      const a = current.end + 0.6
      const b = next ? next.start - 0.4 : capture.end - 3.5
      if (b - a < 1.2) continue
      regions.push({ a, b, k: Math.min(maxSpeed, (b - a) / 1.0) })
   }
   return regions
}

export async function encode(options: EncodeOptions) {

   const { workDir, audioDir, segments, out } = options
   const fps = options.fps ?? 30
   const captions = new Map(segments.map(({ id, caption }) => [id, caption]))
   const capture: Capture = await Bun.file(`${workDir}/capture.json`).json()
   const { t0, end } = capture

   const regions = fastForwardRegions(capture, options.maxSpeed ?? 2.5)
   const warp = (t: number) =>
      regions.reduce((out, { a, b, k }) => t > a ? out - (Math.min(t, b) - a) * (1 - 1 / k) : out, t - t0)

   console.log(`fast-forward: ${regions.map(({ a, b, k }) => `${(a - t0).toFixed(1)}-${(b - t0).toFixed(1)} at ${k.toFixed(1)}x`).join(', ') || 'none'}`)

   const firstIndex = Math.max(0, capture.frames.findLastIndex(({ ts }) => ts <= t0))
   const frames = capture.frames.slice(firstIndex)
   const lines: string[] = []

   for (const [index, frame] of frames.entries()) {
      const next = frames[index + 1]
      const start = Math.max(frame.ts, t0)
      const duration = warp(next ? next.ts : end) - warp(start)
      if (duration <= 0) continue
      lines.push(`file '${frame.file}'`, `duration ${duration.toFixed(6)}`)
   }

   const lastFile = lines.at(-2)
   if (!lastFile) throw new Error('no frames to encode')
   lines.push(lastFile)

   const listFile = `${workDir}/frames.txt`
   const silent = `${workDir}/video-only.mp4`
   const audio = `${workDir}/narration.wav`
   const subtitles = out.replace(/\.mp4$/, '.srt')
   const length = warp(end)

   await Bun.write(listFile, `${lines.join('\n')}\n`)
   console.log(`encoding ${length.toFixed(1)} s from ${frames.length} frames`)

   await $`ffmpeg -y -loglevel error -f concat -safe 0 -i ${listFile} -vf fps=${fps},format=yuv420p -c:v libx264 -preset slow -crf 17 -tune stillimage -r ${fps} -t ${length.toFixed(3)} ${silent}`

   const click = `${workDir}/click.wav`
   const clickSource = 'aevalsrc=\'0.55*sin(2*PI*2400*t)*exp(-t*140)+0.35*sin(2*PI*900*t)*exp(-t*90)\':d=0.07:s=48000'
   await $`ffmpeg -y -loglevel error -f lavfi -i ${clickSource} -af lowpass=6000 ${click}`

   const clicks = capture.clicks.filter(ts => ts >= t0)
   const inputs = [...capture.spoken.flatMap(({ id }) => ['-i', `${audioDir}/${id}.wav`]), '-i', click]
   const delays = capture.spoken.map(({ start }, index) => `[${index}:a]adelay=${Math.round(warp(start) * 1000)}:all=1[a${index}]`)
   const voiceChain = `${capture.spoken.map((_, index) => `[a${index}]`).join('')}amix=inputs=${capture.spoken.length}:normalize=0:dropout_transition=0,apad,atrim=0:${length.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[voice]`
   const clickChains = clicks.length === 0 ? [] : [
      `[${capture.spoken.length}:a]asplit=${clicks.length}${clicks.map((_, index) => `[c${index}]`).join('')}`,
      ...clicks.map((ts, index) => `[c${index}]adelay=${Math.round((warp(ts) + 0.04) * 1000)}:all=1[d${index}]`),
      `${clicks.map((_, index) => `[d${index}]`).join('')}amix=inputs=${clicks.length}:normalize=0:dropout_transition=0,volume=0.22,apad,atrim=0:${length.toFixed(3)}[clicks]`,
      '[voice][clicks]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95[mixed]'
   ]

   const graph = [...delays, voiceChain, ...clickChains].join(';')
   await $`ffmpeg -y -loglevel error ${inputs} -filter_complex ${graph} -map ${clicks.length === 0 ? '[voice]' : '[mixed]'} -c:a pcm_s16le -ar 48000 ${audio}`

   const srt = capture.spoken
      .map(({ id, start, end: stop }, index) =>
         `${index + 1}\n${stamp(warp(start))} --> ${stamp(warp(start) + stop - start + 0.2)}\n${captions.get(id) ?? ''}\n`)
      .join('\n')
   await Bun.write(subtitles, srt)

   await $`ffmpeg -y -loglevel error -i ${silent} -i ${audio} -i ${subtitles} -map 0:v -map 1:a -map 2:s -c:v copy -c:a aac -b:a 192k -c:s mov_text -metadata:s:s:0 language=eng -metadata:s:a:0 language=eng -metadata title=${options.title ?? 'Crypto Tools'} -movflags +faststart ${out}`

   console.log(`wrote ${out} and ${subtitles}`)
}
