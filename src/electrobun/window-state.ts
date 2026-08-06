/// <reference types="bun-types" />
import { readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { Screen, app } from 'electrobun/bun'
import type { BrowserWindow } from 'electrobun/bun'
import { resolveDataDir } from '../server/db/paths.js'

const STATE_VERSION = 1
const STATE_FILE = 'window-state.json'
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 900
const MIN_WIDTH = 800
const MIN_HEIGHT = 600
const MIN_VISIBLE = 120
const MAX_DIMENSION = 20000
const WRITE_DEBOUNCE_MS = 400
const STARTUP_SETTLE_MS = 600
const OFFSCREEN_SENTINEL = -30000

export interface WindowBounds {
   x: number
   y: number
   width: number
   height: number
}

export interface InitialWindowState {
   frame: WindowBounds
   maximized: boolean
}

interface PersistedWindowState {
   version: number
   bounds: WindowBounds
   maximized: boolean
   displays: string
}

let lastWritten: string | null = null

function statePath(): string {
   return path.join(resolveDataDir(), STATE_FILE)
}

function displayFingerprint(): string {
   try {
      return Screen.getAllDisplays()
         .map(display => `${display.id}:${display.bounds.x},${display.bounds.y},${display.bounds.width}x${display.bounds.height}`)
         .sort()
         .join(';')
   }
   catch {
      return ''
   }
}

function primaryWorkArea(): WindowBounds {
   try {
      return Screen.getPrimaryDisplay().workArea
   }
   catch {
      return { x: 0, y: 0, width: 0, height: 0 }
   }
}

function centeredDefault(width: number, height: number): WindowBounds {
   const workArea = primaryWorkArea()
   if (workArea.width < MIN_WIDTH || workArea.height < MIN_HEIGHT) {
      return { x: 0, y: 0, width, height }
   }
   const fittedWidth = Math.min(width, workArea.width)
   const fittedHeight = Math.min(height, workArea.height)
   return {
      x: Math.round(workArea.x + (workArea.width - fittedWidth) / 2),
      y: Math.round(workArea.y + (workArea.height - fittedHeight) / 2),
      width: fittedWidth,
      height: fittedHeight,
   }
}

function readState(): PersistedWindowState | null {
   try {
      const parsed = JSON.parse(readFileSync(statePath(), 'utf-8'))
      if (parsed?.version !== STATE_VERSION
         || typeof parsed.maximized !== 'boolean'
         || typeof parsed.displays !== 'string'
         || !parsed.bounds
         || !Number.isFinite(parsed.bounds.x)
         || !Number.isFinite(parsed.bounds.y)
         || !Number.isFinite(parsed.bounds.width)
         || !Number.isFinite(parsed.bounds.height)) {
         return null
      }
      return parsed as PersistedWindowState
   }
   catch {
      return null
   }
}

function writeState(state: PersistedWindowState): void {
   const serialized = JSON.stringify(state, null, 2)
   if (lastWritten === null) {
      try {
         lastWritten = readFileSync(statePath(), 'utf-8')
      }
      catch {
         lastWritten = ''
      }
   }
   if (serialized === lastWritten) {
      return
   }
   try {
      const target = statePath()
      const temporary = `${target}.tmp`
      writeFileSync(temporary, serialized, 'utf-8')
      renameSync(temporary, target)
      lastWritten = serialized
   }
   catch {
      // Losing the window layout must never take the app down with it
   }
}

function displayBounds(): WindowBounds[] {
   try {
      return Screen.getAllDisplays().map(display => display.bounds)
   }
   catch {
      return []
   }
}

function clampSize(bounds: WindowBounds): WindowBounds {
   const displays = displayBounds()
   const maxWidth = displays.length
      ? displays.reduce((total, display) => total + display.width, 0)
      : MAX_DIMENSION
   const maxHeight = displays.length
      ? Math.max(...displays.map(display => display.height))
      : MAX_DIMENSION
   return {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(MIN_WIDTH, Math.min(bounds.width, maxWidth)),
      height: Math.max(MIN_HEIGHT, Math.min(bounds.height, maxHeight)),
   }
}

function isSanePosition(bounds: WindowBounds): boolean {
   const displays = displayBounds()
   if (displays.length === 0) {
      return true
   }
   const minX = Math.min(...displays.map(display => display.x))
   const maxX = Math.max(...displays.map(display => display.x + display.width))
   const spanY = Math.max(...displays.map(display => Math.abs(display.y) + display.height))
   const horizontallyVisible = bounds.x + bounds.width - MIN_VISIBLE > minX && bounds.x + MIN_VISIBLE < maxX
   const verticallyPlausible = bounds.y > -spanY && bounds.y < spanY + bounds.height
   return horizontallyVisible && verticallyPlausible
}

function isPlausibleLiveFrame(frame: WindowBounds): boolean {
   return Number.isFinite(frame.x)
      && Number.isFinite(frame.y)
      && Number.isFinite(frame.width)
      && Number.isFinite(frame.height)
      && frame.width >= 1
      && frame.height >= 1
      && frame.x > OFFSCREEN_SENTINEL
      && frame.y > OFFSCREEN_SENTINEL
}

function measureFrameOverhead(win: BrowserWindow, requested: WindowBounds): WindowBounds {
   try {
      const frame = win.getFrame()
      if (!isPlausibleLiveFrame(frame)) {
         return { x: 0, y: 0, width: 0, height: 0 }
      }
      return {
         x: frame.x - requested.x,
         y: frame.y - requested.y,
         width: frame.width - requested.width,
         height: frame.height - requested.height,
      }
   }
   catch {
      return { x: 0, y: 0, width: 0, height: 0 }
   }
}

export function resolveInitialWindowState(): InitialWindowState {
   const saved = readState()
   if (!saved) {
      return { frame: centeredDefault(DEFAULT_WIDTH, DEFAULT_HEIGHT), maximized: true }
   }
   const sized = clampSize(saved.bounds)
   if (saved.displays !== displayFingerprint() || !isSanePosition(sized)) {
      return { frame: centeredDefault(sized.width, sized.height), maximized: saved.maximized }
   }
   return { frame: sized, maximized: saved.maximized }
}

export function trackWindowState(win: BrowserWindow, initial: InitialWindowState): void {
   const overhead = measureFrameOverhead(win, initial.frame)
   const current: PersistedWindowState = {
      version: STATE_VERSION,
      bounds: initial.frame,
      maximized: initial.maximized,
      displays: displayFingerprint(),
   }
   let timer: ReturnType<typeof setTimeout> | null = null
   const settleUntil = Date.now() + STARTUP_SETTLE_MS

   const captureLiveFrame = () => {
      if (Date.now() < settleUntil) {
         return
      }
      try {
         if (win.isMinimized() || win.isFullScreen()) {
            return
         }
         const frame = win.getFrame()
         if (!isPlausibleLiveFrame(frame)) {
            return
         }
         current.maximized = win.isMaximized()
         current.displays = displayFingerprint()
         if (!current.maximized) {
            current.bounds = {
               x: frame.x - overhead.x,
               y: frame.y - overhead.y,
               width: frame.width - overhead.width,
               height: frame.height - overhead.height,
            }
         }
      }
      catch {
         // A window that can no longer be queried keeps whatever was captured last
      }
   }

   const scheduleWrite = () => {
      if (Date.now() < settleUntil) {
         return
      }
      if (timer) {
         clearTimeout(timer)
      }
      timer = setTimeout(() => {
         timer = null
         captureLiveFrame()
         writeState(current)
      }, WRITE_DEBOUNCE_MS)
      timer.unref?.()
   }

   const flushWrite = () => {
      if (timer) {
         clearTimeout(timer)
         timer = null
      }
      captureLiveFrame()
      writeState(current)
   }

   win.on('resize', scheduleWrite)
   win.on('move', scheduleWrite)
   win.on('close', flushWrite)
   app.on('before-quit', flushWrite)
}
