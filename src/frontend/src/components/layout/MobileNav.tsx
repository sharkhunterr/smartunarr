import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Tv,
  BarChart3,
  FolderCog,
  Settings
} from 'lucide-react'
import clsx from 'clsx'

const mainNavItems = [
  { path: '/programming', icon: Tv, labelKey: 'nav.programming' },
  { path: '/scoring', icon: BarChart3, labelKey: 'nav.scoring' },
  { path: '/profiles', icon: FolderCog, labelKey: 'nav.profiles' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export function MobileNav() {
  const { t } = useTranslation()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-30">
      <div className="flex items-center justify-around h-16 px-2">
        {mainNavItems.map(({ path, icon: Icon, labelKey }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={clsx('w-5 h-5', isActive && 'scale-110')} />
                <span className="text-[10px] font-medium truncate max-w-[60px]">
                  {t(labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
