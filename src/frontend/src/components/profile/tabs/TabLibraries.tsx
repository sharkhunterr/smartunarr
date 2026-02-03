import { useState, useEffect } from 'react'
import { Loader2, Library, AlertCircle, GripVertical } from 'lucide-react'
import clsx from 'clsx'
import type { LibraryConfig, PlexLibrary } from '@/types'
import { plexApi } from '@/services/api'

interface TabLibrariesProps {
  libraries: LibraryConfig[]
  onChange: (libraries: LibraryConfig[]) => void
}

export function TabLibraries({ libraries, onChange }: TabLibrariesProps) {
  const [availableLibraries, setAvailableLibraries] = useState<PlexLibrary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLibraries()
  }, [])

  const loadLibraries = async () => {
    setLoading(true)
    setError(null)
    try {
      const libs = await plexApi.getLibraries()
      setAvailableLibraries(libs)
    } catch (err) {
      setError('Impossible de charger les bibliotheques Plex')
    } finally {
      setLoading(false)
    }
  }

  const toggleLibrary = (lib: PlexLibrary) => {
    const libKey = String(lib.key)
    const existing = libraries.find(l => String(l.id) === libKey)
    if (existing) {
      onChange(libraries.filter(l => String(l.id) !== libKey))
    } else {
      onChange([
        ...libraries,
        {
          id: libKey,
          name: lib.title,
          type: lib.type === 'show' ? 'show' : 'movie',
          weight: 50,
          enabled: true
        }
      ])
    }
  }

  const updateLibraryWeight = (id: string, weight: number) => {
    onChange(
      libraries.map(lib =>
        String(lib.id) === String(id) ? { ...lib, weight } : lib
      )
    )
  }

  const toggleLibraryEnabled = (id: string) => {
    onChange(
      libraries.map(lib =>
        String(lib.id) === String(id) ? { ...lib, enabled: !lib.enabled } : lib
      )
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadLibraries}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Available Libraries */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Bibliotheques disponibles
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableLibraries.map(lib => {
            const selected = libraries.find(l => String(l.id) === String(lib.key))
            return (
              <button
                key={lib.key}
                onClick={() => toggleLibrary(lib)}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left',
                  selected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <Library className={clsx(
                  'w-5 h-5',
                  selected ? 'text-primary-600' : 'text-gray-400'
                )} />
                <div className="flex-1 min-w-0">
                  <div className={clsx(
                    'font-medium truncate',
                    selected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'
                  )}>
                    {lib.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {lib.type === 'show' ? 'Series' : 'Films'} - {lib.count} items
                  </div>
                </div>
                <div className={clsx(
                  'w-5 h-5 rounded border-2 flex items-center justify-center',
                  selected
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                )}>
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {availableLibraries.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Aucune bibliotheque Plex disponible. Verifiez la configuration Plex.
          </p>
        )}
      </div>

      {/* Selected Libraries with Weights */}
      {libraries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Bibliotheques selectionnees ({libraries.length})
          </h3>
          <div className="space-y-2">
            {libraries.map(lib => (
              <div
                key={lib.id}
                className={clsx(
                  'flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border rounded-lg',
                  lib.enabled
                    ? 'border-gray-200 dark:border-gray-700'
                    : 'border-gray-200 dark:border-gray-700 opacity-50'
                )}
              >
                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />

                <button
                  onClick={() => toggleLibraryEnabled(lib.id)}
                  className={clsx(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    lib.enabled
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                >
                  {lib.enabled && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {lib.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {lib.type === 'show' ? 'Series' : 'Films'}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-48">
                  <span className="text-xs text-gray-500 w-12">Poids:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={lib.weight}
                    onChange={e => updateLibraryWeight(lib.id, Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-right">
                    {lib.weight}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
        <p>
          <strong>Poids:</strong> Determine la probabilite de selection des contenus de chaque bibliotheque.
          Un poids de 100 signifie une priorite maximale, 0 exclut la bibliotheque.
        </p>
      </div>
    </div>
  )
}
