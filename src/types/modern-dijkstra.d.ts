declare module 'modern-dijkstra' {
   export type Graph = Record<string, Record<string, number>>

   // Throws when no route exists between the two nodes.
   export function findPath(graph: Graph, from: string, to: string): string[]
}
