import type { ExportReportType } from './kraken'

export type JobPhase = 'running' | 'done' | 'error' | 'cancelled'

export type SyncMode = 'full' | 'incremental'

// 'pending' is before the step has started and the four terminal phases end it;
// everything in between is a step Kraken is currently working on.
export type SyncStepPhase =
   | 'pending' | 'requesting' | 'waiting' | 'downloading' | 'parsing' | 'storing'
   | 'cleaning' | 'done' | 'error' | 'cancelled' | 'skipped'

export interface SyncCounts {
   parsed: number
   stored: number
   inserted: number
   updated: number
   skipped: number
}

export interface SyncStep {
   report: ExportReportType
   phase: SyncStepPhase
   reportId: string | null
   reportStatus: string | null
   reportRemoved: boolean
   requestedFrom: number | null
   startedAt: number | null
   finishedAt: number | null
   pollCount: number
   counts: SyncCounts
   error: string | null
}

export interface SyncJob {
   accountId: string
   mode: SyncMode
   phase: JobPhase
   startedAt: number
   updatedAt: number
   finishedAt: number | null
   steps: SyncStep[]
   error: string | null
   cancelRequested: boolean
}

export interface StartedJob<T> {
   job: T
   alreadyRunning: boolean
}

export type XStockJobKind = 'classify' | 'describe'

export type XStockStepPhase = 'pending' | 'running' | 'done' | 'error' | 'cancelled' | 'skipped'

export interface XStockStep {
   ticker: string
   group: number
   phase: XStockStepPhase
   activity: string
   searches: string[]
   startedAt: number | null
   finishedAt: number | null
   error: string | null
}

export interface XStockJob {
   kind: XStockJobKind
   wordCount: number | null
   phase: JobPhase
   startedAt: number
   updatedAt: number
   finishedAt: number | null
   steps: XStockStep[]
   error: string | null
   cancelRequested: boolean
}
