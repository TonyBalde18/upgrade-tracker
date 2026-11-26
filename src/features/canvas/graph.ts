/**
 * Builds the React Flow graph: one lane (group node) per upgrade with six phase
 * nodes chained by edges. Phases are evenly spaced; positions dragged by the
 * user are kept.
 */
import type { Edge, Node } from '@xyflow/react'
import type { Customer, Phase, Settings, StatusDef, Task, Upgrade } from '@/lib/model/types'
import { phaseFlow, type PhaseFlowStep } from '@/lib/timeline'
import { progressOf } from '@/lib/template/schedule'
import { envLabel } from '@/lib/upgrade/logic'

export const HEADER_W = 250
export const NODE_W = 196
export const NODE_GAP = 64
export const LANE_GAP = 28
export const BASE_LANE_H = 156
const TASK_ROW_H = 34
const EXPANDED_BASE_H = 150

export type LaneData = {
  upgrade: Upgrade
  customer: Customer | undefined
  status: StatusDef | undefined
  progress: number
  width: number
  height: number
}

export type PhaseData = {
  upgradeId: string
  /** the customer's name for the test environment */
  testName: string
  step: PhaseFlowStep
  tasks: Task[]
  windowStart: string | null
  windowZone: string | null
  expanded: boolean
  width: number
}

export type LaneNode = Node<LaneData, 'lane'>
export type PhaseNode = Node<PhaseData, 'phase'>
export type CanvasNode = LaneNode | PhaseNode

export type FlowEdgeData = { state: 'done' | 'active' | 'future' | 'na'; tone: string }
export type FlowEdge = Edge<FlowEdgeData, 'flow'>

const PHASE_WINDOW: Partial<Record<Phase, 'dev' | 'uat' | 'prod'>> = {
  DEV: 'dev',
  UAT: 'uat',
  PROD: 'prod',
}

function expandedHeight(taskCount: number): number {
  return EXPANDED_BASE_H + taskCount * TASK_ROW_H
}

export interface BuildInput {
  upgrades: Upgrade[]
  customers: Customer[]
  settings: Settings
  expanded: Set<string>
}

export function buildGraph({ upgrades, customers, settings, expanded }: BuildInput): {
  nodes: CanvasNode[]
  edges: FlowEdge[]
} {
  const nodes: CanvasNode[] = []
  const edges: FlowEdge[] = []
  const byId = new Map(customers.map((c) => [c.id, c]))

  const width = HEADER_W + 6 * NODE_W + 5 * NODE_GAP + 40

  let y = 0
  for (const u of upgrades) {
    const flow = phaseFlow(u, settings)
    const saved = u.canvas.nodePositions ?? {}
    const laneId = `lane:${u.id}`
    const tallest = Math.max(
      0,
      ...flow.map((f) => {
        const id = `${u.id}:${f.phase}`
        return expanded.has(id)
          ? 30 + expandedHeight(u.tasks.filter((t) => t.phase === f.phase).length)
          : 0
      }),
    )
    const height = Math.max(BASE_LANE_H, tallest + 24)

    nodes.push({
      id: laneId,
      type: 'lane',
      position: saved.lane ?? { x: 0, y },
      data: {
        upgrade: u,
        customer: byId.get(u.customerId),
        status: settings.scheduleStatuses.find((s) => s.id === u.scheduleStatus),
        progress: progressOf(u.tasks, settings.taskStatuses),
        width,
        height,
      },
      style: { width, height },
      dragHandle: '.lane-handle',
      draggable: true,
      selectable: false,
      zIndex: 0,
    })

    let prev: { id: string; step: PhaseFlowStep } | null = null
    flow.forEach((step, i) => {
      const id = `${u.id}:${step.phase}`
      const env = PHASE_WINDOW[step.phase]
      const win = env ? u.windows[env] : null
      const position = saved[step.phase] ?? { x: HEADER_W + i * (NODE_W + NODE_GAP), y: 30 }
      nodes.push({
        id,
        type: 'phase',
        parentId: laneId,
        position,
        data: {
          upgradeId: u.id,
          testName: envLabel('uat', byId.get(u.customerId)),
          step,
          tasks: u.tasks.filter((t) => t.phase === step.phase).sort((a, b) => a.order - b.order),
          windowStart: win?.start ?? null,
          windowZone: win?.timeZone ?? null,
          expanded: expanded.has(id),
          width: NODE_W,
        },
        draggable: true,
        zIndex: expanded.has(id) ? 20 : 10,
      })
      if (!prev) {
        // from the lane header into the first phase
        edges.push({
          id: `${laneId}->${id}`,
          source: laneId,
          target: id,
          type: 'flow',
          data: {
            state:
              step.state === 'current' || step.state === 'blocked'
                ? 'active'
                : step.state === 'done'
                  ? 'done'
                  : 'future',
            tone: step.phase,
          },
          zIndex: 5,
        })
      }
      if (prev) {
        const state: FlowEdgeData['state'] =
          step.state === 'current' || step.state === 'blocked'
            ? 'active'
            : step.state === 'done'
              ? 'done'
              : step.state === 'na' || prev.step.state === 'na'
                ? 'na'
                : 'future'
        edges.push({
          id: `${prev.id}->${id}`,
          source: prev.id,
          target: id,
          type: 'flow',
          data: { state, tone: step.phase },
          zIndex: 5,
        })
      }
      prev = { id, step }
    })
    y += height + LANE_GAP
  }

  return { nodes, edges }
}
