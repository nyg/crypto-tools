const SIDES = ['x', 'y', 'width', 'height'] as const
const SHRUNK_SHARE = 0.8

export interface WindowBounds {
   x: number
   y: number
   width: number
   height: number
}

export function fillsWorkArea(bounds: WindowBounds, workAreas: WindowBounds[]): boolean {
   return workAreas.some(workArea => SIDES.every(side => Math.abs(bounds[side] - workArea[side]) < 1))
}

export function shrunkFrame(frame: WindowBounds): WindowBounds {
   const width = Math.round(frame.width * SHRUNK_SHARE)
   const height = Math.round(frame.height * SHRUNK_SHARE)
   return {
      x: Math.round(frame.x + (frame.width - width) / 2),
      y: Math.round(frame.y + (frame.height - height) / 2),
      width,
      height,
   }
}
