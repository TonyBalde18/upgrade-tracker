import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { LayoutGrid, Maximize, Workflow, CalendarRange, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import { useTracker, undo } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { resetCanvasPositions, saveCanvasPositions } from '@/store/upgradeActions'
import { isActiveUpgrade } from '@/lib/upgrade/logic'
import { todayIn } from '@/lib/dates'
import { readString, writeString } from '@/lib/storage/local'
import { phaseTone, tones } from '@/theme/brand'
import { useAppliedTheme } from '@/app/ThemeApplier'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tooltip } from '@/components/ui/Tooltip'
import { buildGraph, type CanvasNode, type Layout, type PhaseNode } from './graph'
import { edgeTypes, nodeTypes } from './nodes'

function upgradeIdOf(nodeId: string): string {
  if (nodeId.startsWith('lane:')) return nodeId.slice(5)
  return nodeId.slice(0, nodeId.lastIndexOf(':'))
}

function Canvas() {
  const doc = useTracker((s) => s.doc)
  const { settings, customers, upgrades } = doc
  const navigate = useNavigate()
  const rf = useReactFlow()
  const theme = useAppliedTheme()
  const setNewUpgradeOpen = useUi((s) => s.setNewUpgradeOpen)
  const today = todayIn(settings.displayTimeZone)

  const [layout, setLayoutState] = useState<Layout>(() =>
    readString('canvasLayout') === 'time' ? 'time' : 'free',
  )
  const setLayout = (l: Layout) => {
    setLayoutState(l)
    writeString('canvasLayout', l)
  }
  const [status, setStatus] = useState('all')
  const [family, setFamily] = useState('all')
  const [customer, setCustomer] = useState('all')
  const [hideDone, setHideDone] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const visible = useMemo(
    () =>
      upgrades
        .filter((u) => !hideDone || isActiveUpgrade(u, settings))
        .filter((u) => status === 'all' || u.scheduleStatus === status)
        .filter((u) => family === 'all' || u.family === family)
        .filter((u) => customer === 'all' || u.customerId === customer)
        .sort((a, b) => {
          const na = customerById.get(a.customerId)?.name ?? ''
          const nb = customerById.get(b.customerId)?.name ?? ''
          return na.localeCompare(nb) || a.windows.prod.start.localeCompare(b.windows.prod.start)
        }),
    [upgrades, hideDone, status, family, customer, settings, customerById],
  )

  const graph = useMemo(
    () => buildGraph({ upgrades: visible, customers, settings, layout, expanded, today }),
    [visible, customers, settings, layout, expanded, today],
  )
  const [nodes, setNodes] = useState<CanvasNode[]>(graph.nodes)
  useEffect(() => setNodes(graph.nodes), [graph.nodes])

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setNodes((ns) =>
      applyNodeChanges(
        changes.filter((c) => c.type !== 'remove'),
        ns,
      ),
    )
  }, [])

  // fit the view when the set of lanes or the layout changes
  const fitKey = `${layout}|${visible.map((u) => u.id).join(',')}`
  const lastFit = useRef('')
  useEffect(() => {
    if (lastFit.current === fitKey) return
    lastFit.current = fitKey
    const id = setTimeout(() => void rf.fitView({ padding: 0.12, duration: 600, maxZoom: 1 }), 60)
    return () => clearTimeout(id)
  }, [fitKey, rf])

  const onNodeDragStop = useCallback(
    (_: unknown, _node: Node, dragged: Node[]) => {
      if (layout !== 'free') return
      const byUpgrade = new Map<string, Record<string, { x: number; y: number }>>()
      for (const n of dragged) {
        const uid = upgradeIdOf(n.id)
        const key = n.id.startsWith('lane:') ? 'lane' : n.id.slice(n.id.lastIndexOf(':') + 1)
        const rec = byUpgrade.get(uid) ?? {}
        rec[key] = { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        byUpgrade.set(uid, rec)
      }
      const current = useTracker.getState().doc.upgrades
      for (const [uid, rec] of byUpgrade) {
        const u = current.find((x) => x.id === uid)
        if (u) saveCanvasPositions(uid, { ...(u.canvas.nodePositions ?? {}), ...rec })
      }
    },
    [layout],
  )

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    if (node.type !== 'phase') return
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(node.id)) n.delete(node.id)
      else n.add(node.id)
      return n
    })
  }, [])
  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === 'phase' || node.type === 'lane')
        navigate(`/upgrades/${upgradeIdOf(node.id)}`)
    },
    [navigate],
  )

  const hasCustom = visible.some((u) => u.canvas.nodePositions)
  const families = [...new Set(upgrades.map((u) => u.family))].sort()

  const miniColor = (n: Node) => {
    if (n.type === 'phase') {
      const d = (n as PhaseNode).data
      if (d.step.state === 'current') return '#E1292C'
      return tones[phaseTone[d.step.phase]].solid
    }
    if (n.type === 'lane') return 'rgba(148,163,184,0.18)'
    return 'transparent'
  }

  if (upgrades.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <EmptyState
          icon={<Workflow />}
          title="No upgrades yet"
          body="Create the first one and it will flow onto the canvas."
          actions={
            <Button variant="primary" onClick={() => setNewUpgradeOpen(true)}>
              New upgrade
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="ut-flow bg-pattern-grid relative h-full">
      <ReactFlow<CanvasNode>
        nodes={nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        colorMode={theme}
        minZoom={0.15}
        maxZoom={1.8}
        deleteKeyCode={null}
        nodesConnectable={false}
        elementsSelectable
        zoomOnDoubleClick={false}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
      >
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.4}
          color="var(--ut-border-strong)"
        />
        <Background
          id="grid"
          variant={BackgroundVariant.Lines}
          gap={192}
          color="var(--ut-border)"
        />
        <MiniMap
          pannable
          zoomable
          nodeColor={miniColor}
          nodeStrokeWidth={0}
          maskColor={theme === 'dark' ? 'rgba(15,1,0,0.65)' : 'rgba(247,244,244,0.7)'}
        />
        <Controls showInteractive={false} position="bottom-left" />

        <Panel position="top-left" className="!m-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/90 p-2 shadow-card backdrop-blur">
            <Segmented<Layout>
              ariaLabel="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                {
                  value: 'free',
                  label: (
                    <>
                      <LayoutGrid className="h-3.5 w-3.5" /> Free
                    </>
                  ),
                },
                {
                  value: 'time',
                  label: (
                    <>
                      <CalendarRange className="h-3.5 w-3.5" /> Time axis
                    </>
                  ),
                },
              ]}
            />
            <div className="w-40">
              <Select
                size="sm"
                ariaLabel="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: 'All statuses' },
                  ...settings.scheduleStatuses.map((s) => ({ value: s.id, label: s.label })),
                ]}
              />
            </div>
            <div className="w-36">
              <Select
                size="sm"
                ariaLabel="Release"
                value={family}
                onChange={setFamily}
                options={[
                  { value: 'all', label: 'All releases' },
                  ...families.map((f) => ({ value: f, label: f })),
                ]}
              />
            </div>
            <div className="w-44">
              <Select
                size="sm"
                ariaLabel="Customer"
                value={customer}
                onChange={setCustomer}
                options={[
                  { value: 'all', label: 'All customers' },
                  ...[...customers]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <label className="flex items-center gap-2 px-1 text-xs text-muted">
              <Switch checked={hideDone} onCheckedChange={setHideDone} label="Hide done" /> Hide
              done
            </label>
            <Tooltip
              content={
                layout === 'time'
                  ? 'Only in free layout'
                  : hasCustom
                    ? 'Forget dragged positions'
                    : 'Already auto-laid out'
              }
            >
              <span>
                <Button
                  size="sm"
                  disabled={layout === 'time' || !hasCustom}
                  onClick={() => {
                    resetCanvasPositions(visible.map((u) => u.id))
                    toast('Auto-layout applied', { action: { label: 'Undo', onClick: undo } })
                    setTimeout(
                      () => void rf.fitView({ padding: 0.12, duration: 600, maxZoom: 1 }),
                      60,
                    )
                  }}
                >
                  <Shuffle className="h-3.5 w-3.5" /> Auto-layout
                </Button>
              </span>
            </Tooltip>
            <Tooltip content="Fit everything in view">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void rf.fitView({ padding: 0.12, duration: 600, maxZoom: 1 })}
                aria-label="Fit view"
              >
                <Maximize className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        </Panel>

        <Panel position="bottom-center" className="!mb-3">
          <div className="rounded-full border border-border bg-surface/85 px-3 py-1 text-[0.7rem] text-subtle backdrop-blur">
            Click a phase to expand it · double-click to open the plan ·{' '}
            {layout === 'free'
              ? 'drag lanes by their header, or drag single phases'
              : 'x = date on a shared axis'}
          </div>
        </Panel>

        {visible.length === 0 && (
          <Panel position="top-center" className="!mt-24">
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted shadow-card">
              No upgrades match these filters.
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
