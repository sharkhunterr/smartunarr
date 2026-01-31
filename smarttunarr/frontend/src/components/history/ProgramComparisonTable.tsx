import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { ProgramComparison } from '@/types'
import { getDeltaColor, formatDelta, getStatusInfo } from '@/utils/comparison'

interface ProgramRowProps {
  program: ProgramComparison
}

function ProgramRow({ program }: ProgramRowProps) {
  const [expanded, setExpanded] = useState(false)
  const statusInfo = getStatusInfo(program.status)
  const hasCriteria = program.criteriaDeltas && Object.keys(program.criteriaDeltas).length > 0
  const canExpand = hasCriteria && program.status !== 'added' && program.status !== 'removed'

  const criterionLabels: Record<string, string> = {
    type: 'Type',
    duration: 'Duree',
    genre: 'Genre',
    timing: 'Timing',
    strategy: 'Strategie',
    age: 'Age',
    rating: 'Note',
    filter: 'Filtre',
    bonus: 'Bonus',
  }

  return (
    <>
      <tr
        className={clsx(
          'border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30',
          canExpand && 'cursor-pointer'
        )}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {canExpand ? (
              expanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )
            ) : (
              <span className="w-4" />
            )}
            <span className="text-sm text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
              {program.title}
            </span>
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {program.scoreA !== null ? program.scoreA.toFixed(1) : '-'}
          </span>
        </td>
        <td className="px-3 py-2 text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {program.scoreB !== null ? program.scoreB.toFixed(1) : '-'}
          </span>
        </td>
        <td className="px-3 py-2 text-center">
          <span className={clsx('text-sm font-medium', getDeltaColor(program.delta))}>
            {formatDelta(program.delta)}
          </span>
        </td>
        <td className="px-3 py-2 text-center">
          <span className={clsx('text-sm font-medium inline-flex items-center gap-1', statusInfo.color)}>
            <span>{statusInfo.icon}</span>
            <span className="hidden sm:inline">{statusInfo.label}</span>
          </span>
        </td>
      </tr>
      {expanded && canExpand && program.criteriaDeltas && (
        <tr className="bg-gray-50 dark:bg-gray-700/20">
          <td colSpan={5} className="px-3 py-2">
            <div className="ml-6 grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
              {Object.entries(program.criteriaDeltas).map(([criterion, values]) => (
                <div key={criterion} className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">
                    {criterionLabels[criterion] || criterion}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600 dark:text-gray-300">
                      {values.scoreA !== null ? values.scoreA.toFixed(0) : '-'}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-600 dark:text-gray-300">
                      {values.scoreB !== null ? values.scoreB.toFixed(0) : '-'}
                    </span>
                    {values.delta !== null && Math.abs(values.delta) >= 0.5 && (
                      <span className={clsx('font-medium', getDeltaColor(values.delta))}>
                        ({formatDelta(values.delta, 0)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

interface ProgramComparisonTableProps {
  programs: ProgramComparison[]
  maxHeight?: string
}

export function ProgramComparisonTable({ programs, maxHeight = '400px' }: ProgramComparisonTableProps) {
  // Group programs by status for better readability
  const removed = programs.filter(p => p.status === 'removed')
  const added = programs.filter(p => p.status === 'added')
  const changed = programs.filter(p => p.status !== 'added' && p.status !== 'removed')

  const orderedPrograms = [...removed, ...changed, ...added]

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto" style={{ maxHeight }}>
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                Programme
              </th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-20">
                Score A
              </th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-20">
                Score B
              </th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-16">
                Delta
              </th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-24">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedPrograms.map((program, idx) => (
              <ProgramRow key={`${program.title}-${idx}`} program={program} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
