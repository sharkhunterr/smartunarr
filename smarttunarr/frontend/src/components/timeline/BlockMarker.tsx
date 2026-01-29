import clsx from 'clsx'
import type { TimeBlock } from '@/types'

interface BlockMarkerProps {
  block: TimeBlock
  isActive?: boolean
}

const blockColors = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-cyan-500',
]

export function BlockMarker({ block, isActive = false }: BlockMarkerProps) {
  // Get a consistent color based on block name
  const colorIndex = block.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const bgColor = blockColors[colorIndex % blockColors.length]

  return (
    <div
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
        isActive
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      )}
    >
      <div className={clsx('w-3 h-3 rounded-full', bgColor)} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {block.name}
        </span>
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          {block.start_time} - {block.end_time}
        </span>
      </div>
    </div>
  )
}

interface BlockMarkersListProps {
  blocks: TimeBlock[]
  currentTime?: string
}

export function BlockMarkersList({ blocks, currentTime }: BlockMarkersListProps) {
  const isBlockActive = (block: TimeBlock): boolean => {
    if (!currentTime) return false
    const current = currentTime.replace(':', '')
    const start = block.start_time.replace(':', '')
    const end = block.end_time.replace(':', '')

    // Handle overnight blocks
    if (end < start) {
      return current >= start || current < end
    }
    return current >= start && current < end
  }

  return (
    <div className="flex flex-wrap gap-2">
      {blocks.map((block, index) => (
        <BlockMarker
          key={index}
          block={block}
          isActive={isBlockActive(block)}
        />
      ))}
    </div>
  )
}
