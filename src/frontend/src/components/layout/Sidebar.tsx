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
        <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
          SmartTunarr
        </h1>
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
