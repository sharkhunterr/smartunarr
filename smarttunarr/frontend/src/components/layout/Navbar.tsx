import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, Menu } from 'lucide-react'
import { useThemeStore } from '@/stores/useThemeStore'
import clsx from 'clsx'

interface NavbarProps {
  onMenuClick?: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useThemeStore()

  const themes = [
    { value: 'light', icon: Sun, label: t('settings.themes.light') },
    { value: 'dark', icon: Moon, label: t('settings.themes.dark') },
    { value: 'system', icon: Monitor, label: t('settings.themes.system') },
  ] as const

  const languages = [
    { value: 'fr', label: 'FR', flag: '🇫🇷' },
    { value: 'en', label: 'EN', flag: '🇬🇧' },
    { value: 'it', label: 'IT', flag: '🇮🇹' },
    { value: 'es', label: 'ES', flag: '🇪🇸' },
    { value: 'de', label: 'DE', flag: '🇩🇪' },
  ]

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('locale', lang)
  }

  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 sm:px-4 lg:px-6">
      {/* Left side: Hamburger menu (mobile only) */}
      <div className="flex items-center">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Right side: Language flags + Theme icons */}
      <div className="flex items-center gap-2">
        {/* Language Switcher with flags */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {languages.map(({ value, label, flag }) => (
            <button
              key={value}
              onClick={() => handleLanguageChange(value)}
              className={clsx(
                'px-2 py-1.5 rounded-md transition-colors flex items-center gap-1',
                i18n.language === value
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
              title={label}
            >
              <span className="text-base leading-none">{flag}</span>
            </button>
          ))}
        </div>

        {/* Theme Switcher */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {themes.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              title={label}
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                theme === value
                  ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
