import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Tv,
  BarChart3,
  CalendarClock,
  FolderCog,
  History,
  Settings,
  ScrollText,
  X
} from 'lucide-react'
import clsx from 'clsx'

function SmarTunarrLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
    >
      {/* TV Frame */}
      <rect x="4" y="8" width="56" height="40" rx="6" stroke="currentColor" strokeWidth="3" fill="none" />
      {/* Screen inner border */}
      <rect x="10" y="14" width="44" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
      {/* Programming blocks row 1 */}
      <rect x="14" y="18" width="10" height="6" rx="1" fill="#10B981" />
      <rect x="26" y="18" width="14" height="6" rx="1" fill="#F59E0B" />
      <rect x="42" y="18" width="8" height="6" rx="1" fill="#EF4444" />
      {/* Programming blocks row 2 */}
      <rect x="14" y="26" width="16" height="6" rx="1" fill="#8B5CF6" />
      <rect x="32" y="26" width="18" height="6" rx="1" fill="#3B82F6" />
      {/* Programming blocks row 3 */}
      <rect x="14" y="34" width="8" height="4" rx="1" fill="#EC4899" />
      <rect x="24" y="34" width="12" height="4" rx="1" fill="#06B6D4" />
      <rect x="38" y="34" width="12" height="4" rx="1" fill="#F97316" />
      {/* Stand */}
      <path d="M24 48 L24 52 L20 56 L44 56 L40 52 L40 48" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const navItems = [
  { path: '/programming', icon: Tv, labelKey: 'nav.programming' },
  { path: '/scoring', icon: BarChart3, labelKey: 'nav.scoring' },
  { path: '/schedules', icon: CalendarClock, labelKey: 'nav.schedules' },
  { path: '/profiles', icon: FolderCog, labelKey: 'nav.profiles' },
  { path: '/history', icon: History, labelKey: 'nav.history' },
  { path: '/logs', icon: ScrollText, labelKey: 'nav.logs' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { t } = useTranslation()

  return (
    <aside className="w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <SmarTunarrLogo className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
            SmarTunarr
          </h1>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 -mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, labelKey }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
