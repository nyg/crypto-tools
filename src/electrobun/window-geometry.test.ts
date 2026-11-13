import { describe, expect, test } from 'bun:test'
import { fillsWorkArea, shrunkFrame } from './window-geometry'

const workArea = { x: 0, y: 33, width: 1676, height: 1084 }
const secondWorkArea = { x: 1728, y: 25, width: 1920, height: 1055 }

describe('a window that fills a work area', () => {

   test('has the frame of that work area', () => {
      expect(fillsWorkArea({ x: 0, y: 33, width: 1676, height: 1084 }, [workArea])).toBe(true)
   })

   test('may be on any display', () => {
      expect(fillsWorkArea({ x: 1728, y: 25, width: 1920, height: 1055 }, [workArea, secondWorkArea])).toBe(true)
   })

   test('may be off by less than a point, since a work area is reported in whole points', () => {
      expect(fillsWorkArea({ x: 0, y: 33.5, width: 1676, height: 1083.5 }, [workArea])).toBe(true)
   })

   test('is not one a few points short of it, which AppKit still reports as zoomed', () => {
      expect(fillsWorkArea({ x: 0, y: 36, width: 1676, height: 1079 }, [workArea])).toBe(false)
      expect(fillsWorkArea({ x: 0, y: 33, width: 1676, height: 1083 }, [workArea])).toBe(false)
      expect(fillsWorkArea({ x: 1, y: 33, width: 1675, height: 1084 }, [workArea])).toBe(false)
   })

   test('is not one of the same size somewhere else', () => {
      expect(fillsWorkArea({ x: 0, y: 43, width: 1676, height: 1084 }, [workArea])).toBe(false)
   })

   test('is none when no display is known', () => {
      expect(fillsWorkArea({ x: 0, y: 33, width: 1676, height: 1084 }, [])).toBe(false)
   })
})

describe('a frame shrunk before it is zoomed', () => {

   test('keeps its centre and loses a fifth of each side', () => {
      expect(shrunkFrame({ x: 0, y: 36, width: 1676, height: 1079 })).toEqual({ x: 168, y: 144, width: 1341, height: 863 })
   })

   test('stays on the display it was on', () => {
      expect(shrunkFrame({ x: 1728, y: 25, width: 1920, height: 1055 })).toEqual({ x: 1920, y: 131, width: 1536, height: 844 })
   })
})
