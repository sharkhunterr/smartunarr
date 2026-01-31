import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, Menu, ChevronDown, Check } from 'lucide-react'
import { useThemeStore } from '@/stores/useThemeStore'
import clsx from 'clsx'

interface NavbarProps {
  onMenuClick?: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useThemeStore()

  // Dropdown states
  const [langOpen, setLangOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)

  const themes = [
    { value: 'light', icon: Sun, label: t('settings.themes.light') },
    { value: 'dark', icon: Moon, label: t('settings.themes.dark') },
    { value: 'system', icon: Monitor, label: t('settings.themes.system') },
  ] as const

  const languages = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
    { value: 'it', label: 'Italiano', flag: '🇮🇹' },
    { value: 'es', label: 'Español', flag: '🇪🇸' },
    { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  ]

  const currentLanguage = languages.find(l => l.value === i18n.language) || languages[0]
  const currentTheme = themes.find(t => t.value === theme) || themes[0]

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('locale', lang)
    setLangOpen(false)
  }

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    setTheme(value)
    setThemeOpen(false)
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false)
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

      {/* Right side: Language dropdown + Theme dropdown */}
      <div className="flex items-center gap-2">
        {/* Language Dropdown */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => { setLangOpen(!langOpen); setThemeOpen(false) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <span className="text-lg leading-none">{currentLanguage.flag}</span>
            <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-500 transition-transform', langOpen && 'rotate-180')} />
          </button>

          {langOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
              {languages.map(({ value, label, flag }) => (
                <button
                  key={value}
                  onClick={() => handleLanguageChange(value)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                    i18n.language === value && 'bg-gray-50 dark:bg-gray-700/50'
                  )}
                >
                  <span className="text-base">{flag}</span>
                  <span className="flex-1 text-left text-gray-900 dark:text-white">{label}</span>
                  {i18n.language === value && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Dropdown */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => { setThemeOpen(!themeOpen); setLangOpen(false) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <currentTheme.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-500 transition-transform', themeOpen && 'rotate-180')} />
          </button>

          {themeOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
              {themes.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                    theme === value && 'bg-gray-50 dark:bg-gray-700/50'
                  )}
                >
                  <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="flex-1 text-left text-gray-900 dark:text-white">{label}</span>
                  {theme === value && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
