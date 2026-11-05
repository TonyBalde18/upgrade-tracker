/**
 * Builds the React Flow graph: one lane (group node) per upgrade with six phase
 * nodes chained by edges. Two layouts:
 *  - free: phases evenly spaced; positions dragged by the user are kept
 *  - time: x = date on a shared axis for every lane (not draggable)
 */
import type { Edge, Node } from '@xyflow/react'
import type { Customer, Phase, Settings, StatusDef, Task, Upgrade } from '@/lib/model/types'
import { addDaysIso, diffDaysIso, isoWeekOf } from '@/lib/dates'
import { phaseFlow, type PhaseFlowStep } from '@/lib/timeline'
import { progressOf } from '@/lib/template/schedule'

export type Layout = 'free' | 'time'

export const HEADER_W = 250
export const NODE_W = 196
export const NODE_GAP = 64
export const LANE_GAP = 28
export const BASE_LANE_H = 156
export const TIME_PX = 22 // px per day on the time axis
const TASK_ROW_H = 34
const EXPANDED_BASE_H = 150

export type LaneData = {
  upgrade: Upgrade
  customer: Customer | undefined
  status: StatusDef | undefined
  progress: number
  width: number
  height: number
  layout: Layout
}

export type PhaseData = {
  upgradeId: string
  step: PhaseFlowStep
  tasks: Task[]
  windowStart: string | null
  windowZone: string | null
  expanded: boolean
  layout: Layout
  width: number
}

export type AxisData = { start: string; days: number; px: number; today: string }
export type TodayData = { height: number }

export type LaneNode = Node<LaneData, 'lane'>
export type PhaseNode = Node<PhaseData, 'phase'>
export type AxisNode = Node<AxisData, 'axis'>
export type TodayNode = Node<TodayData, 'today'>
export type CanvasNode = LaneNode | PhaseNode | AxisNode | TodayNode

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
  layout: Layout
  expanded: Set<string>
  today: string
}

export function buildGraph({
  upgrades,
  customers,
  settings,
  layout,
  expanded,
  today,
}: BuildInput): {
  nodes: CanvasNode[]
  edges: FlowEdge[]
} {
  const nodes: CanvasNode[] = []
  const edges: FlowEdge[] = []
  const byId = new Map(customers.map((c) => [c.id, c]))

  // shared time axis
  const allDates = upgrades
    .flatMap((u) => u.tasks.flatMap((t) => [t.start, t.end]))
    .filter((d): d is string => !!d)
    .sort()
  const axisStart = isoWeekOf(addDaysIso(allDates[0] ?? today, -7)).monday
  const axisEnd = addDaysIso(allDates[allDates.length - 1] ?? today, 14)
  const axisDays = Math.max(28, diffDaysIso(axisEnd, axisStart) + 1)
  const xOfDate = (iso: string) => HEADER_W + diffDaysIso(iso, axisStart) * TIME_PX

  const freeWidth = HEADER_W + 6 * NODE_W + 5 * NODE_GAP + 40
  const timeWidth = HEADER_W + axisDays * TIME_PX + 40

  let y = layout === 'time' ? 70 : 0
  for (const u of upgrades) {
    const flow = phaseFlow(u, settings)
    const saved = layout === 'free' ? (u.canvas.nodePositions ?? {}) : {}
    const laneId = `lane:${u.id}`
    const visible = layout === 'time' ? flow.filter((f) => f.span) : flow
    const tallest = Math.max(
      0,
      ...visible.map((f, i) => {
        const id = `${u.id}:${f.phase}`
        const top = layout === 'time' ? 22 + (i % 2) * 64 : 30
        return expanded.has(id)
          ? top + expandedHeight(u.tasks.filter((t) => t.phase === f.phase).length)
          : 0
      }),
    )
    const height = Math.max(layout === 'time' ? 172 : BASE_LANE_H, tallest + 24)
    const width = layout === 'time' ? timeWidth : freeWidth

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
        layout,
      },
      style: { width, height },
      dragHandle: '.lane-handle',
      draggable: layout === 'free',
      selectable: false,
      zIndex: 0,
    })

    let prev: { id: string; step: PhaseFlowStep } | null = null
    visible.forEach((step, i) => {
      const id = `${u.id}:${step.phase}`
      const env = PHASE_WINDOW[step.phase]
      const win = env ? u.windows[env] : null
      let position = saved[step.phase] ?? { x: HEADER_W + i * (NODE_W + NODE_GAP), y: 30 }
      let nodeW = NODE_W
      if (layout === 'time' && step.span) {
        const days = diffDaysIso(step.span.end, step.span.start) + 1
        nodeW = Math.max(132, days * TIME_PX)
        position = { x: xOfDate(step.span.start), y: 22 + (i % 2) * 64 }
      }
      nodes.push({
        id,
        type: 'phase',
        parentId: laneId,
        position,
        data: {
          upgradeId: u.id,
          step,
          tasks: u.tasks.filter((t) => t.phase === step.phase).sort((a, b) => a.order - b.order),
          windowStart: win?.start ?? null,
          windowZone: win?.timeZone ?? null,
          expanded: expanded.has(id),
          layout,
          width: nodeW,
        },
        draggable: layout === 'free',
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

  if (layout === 'time' && upgrades.length > 0) {
    nodes.push({
      id: 'axis',
      type: 'axis',
      position: { x: HEADER_W, y: 0 },
      data: { start: axisStart, days: axisDays, px: TIME_PX, today },
      draggable: false,
      selectable: false,
      zIndex: 1,
    })
    const ti = diffDaysIso(today, axisStart)
    if (ti >= 0 && ti <= axisDays) {
      nodes.push({
        id: 'today',
        type: 'today',
        position: { x: xOfDate(today) + TIME_PX / 2, y: 0 },
        data: { height: y },
        draggable: false,
        selectable: false,
        zIndex: 30,
      })
    }
  }
  return { nodes, edges }
}
