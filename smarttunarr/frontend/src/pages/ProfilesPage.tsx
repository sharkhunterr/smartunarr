import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Trash2,
  Edit,
  Loader2,
  Download,
  Upload,
  Copy,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  Tag,
  Clock,
  Settings2,
  FileJson
} from 'lucide-react'
import { profilesApi } from '@/services/api'
import type { Profile, TimeBlock, ScoringWeights } from '@/types'

interface ProfileModalProps {
  profile: Profile | null
  onClose: () => void
}

function ProfileViewModal({ profile, onClose }: ProfileModalProps) {
  const { t } = useTranslation()

  if (!profile) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50">
      <div className="w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">
            {profile.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div>
              <label className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Version</label>
              <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">v{profile.version}</p>
            </div>
            <div>
              <label className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('programming.iterations')}</label>
              <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{profile.default_iterations}</p>
            </div>
            <div>
              <label className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('programming.randomness')}</label>
              <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{(profile.default_randomness * 100).toFixed(0)}%</p>
            </div>
          </div>

          {/* Labels */}
          {profile.labels.length > 0 && (
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
                <Tag className="w-4 h-4" />
                {t('profiles.labels')}
              </label>
              <div className="flex flex-wrap gap-2">
                {profile.labels.map(label => (
                  <span
                    key={label}
                    className="px-3 py-1 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Time blocks */}
          <div>
            <label className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
              <Clock className="w-4 h-4" />
              {t('profiles.timeBlocks')} ({profile.time_blocks.length})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profile.time_blocks.map((block: TimeBlock, index: number) => (
                <div
                  key={index}
                  className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                    {block.name}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {block.start_time} - {block.end_time}
                  </div>
                  {block.criteria.preferred_genres && block.criteria.preferred_genres.length > 0 && (
                    <div className="mt-1 text-xs text-gray-400 truncate">
                      Genres: {block.criteria.preferred_genres.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Scoring weights */}
          <div>
            <label className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
              <Settings2 className="w-4 h-4" />
              {t('profiles.scoringWeights')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 sm:gap-2">
              {Object.entries(profile.scoring_weights as ScoringWeights).map(([key, value]) => (
                <div key={key} className="p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-700 rounded text-center">
                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                    {t(`scoring.criteria.${key}`)}
                  </div>
                  <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Libraries */}
          <div>
            <label className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 block">
              Bibliothèques ({profile.libraries.length})
            </label>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {profile.libraries.map((lib, index) => (
                <span
                  key={index}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                >
                  {lib.name} (poids: {lib.weight})
                </span>
              ))}
            </div>
          </div>

          {/* Raw JSON */}
          <details className="group">
            <summary className="cursor-pointer text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Voir le JSON brut
            </summary>
            <pre className="mt-2 p-2 sm:p-4 bg-gray-900 text-gray-100 text-[10px] sm:text-xs rounded-lg overflow-x-auto">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}

export function ProfilesPage() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // View modal
  const [viewProfile, setViewProfile] = useState<Profile | null>(null)

  // Duplicate modal
  const [duplicateProfile, setDuplicateProfile] = useState<Profile | null>(null)
  const [duplicateName, setDuplicateName] = useState('')

  // Import state
  const [importing, setImporting] = useState(false)
  const [importOverwrite, setImportOverwrite] = useState(false)

  useEffect(() => {
    loadProfiles()
  }, [])

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  const loadProfiles = async () => {
    try {
      const data = await profilesApi.list()
      setProfiles(data)
    } catch {
      setError('Erreur lors du chargement des profils')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('profiles.confirmDelete'))) return

    setActionId(id)
    try {
      await profilesApi.delete(id)
      setProfiles(prev => prev.filter(p => p.id !== id))
      setSuccess('Profil supprimé')
    } catch {
      setError('Erreur lors de la suppression')
    } finally {
      setActionId(null)
    }
  }

  const handleExport = async (profile: Profile) => {
    setActionId(profile.id)
    try {
      const data = await profilesApi.export(profile.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `profile-${profile.name.toLowerCase().replace(/\s+/g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess('Profil exporté')
    } catch {
      setError("Erreur lors de l'export")
    } finally {
      setActionId(null)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate first
      const validation = await profilesApi.validate(data)
      if (!validation.valid) {
        setError(`JSON invalide: ${validation.errors.join(', ')}`)
        return
      }

      if (validation.warnings.length > 0) {
        console.warn('Import warnings:', validation.warnings)
      }

      // Import
      await profilesApi.import(data, importOverwrite)
      await loadProfiles()
      setSuccess('Profil importé avec succès')
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        setError('Le fichier JSON est invalide')
      } else {
        const errorMessage = err instanceof Error ? err.message : "Erreur lors de l'import"
        setError(errorMessage)
      }
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDuplicate = async () => {
    if (!duplicateProfile || !duplicateName.trim()) return

    setActionId(duplicateProfile.id)
    try {
      const newProfile = await profilesApi.duplicate(duplicateProfile.id, duplicateName.trim())
      setProfiles(prev => [...prev, newProfile])
      setDuplicateProfile(null)
      setDuplicateName('')
      setSuccess('Profil dupliqué')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la duplication'
      setError(errorMessage)
    } finally {
      setActionId(null)
    }
  }

  const handleView = async (profile: Profile) => {
    setActionId(profile.id)
    try {
      const fullProfile = await profilesApi.get(profile.id)
      setViewProfile(fullProfile)
    } catch {
      setError('Erreur lors du chargement du profil')
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t('profiles.title')}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={importOverwrite}
              onChange={e => setImportOverwrite(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="hidden sm:inline">Écraser si existant</span>
            <span className="sm:hidden">Écraser</span>
          </label>
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
          >
            {importing ? (
              <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
            ) : (
              <Upload className="w-4 sm:w-5 h-4 sm:h-5" />
            )}
            <span className="hidden sm:inline">{t('common.import')}</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm">
            <Plus className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="hidden sm:inline">{t('profiles.create')}</span>
            <span className="sm:hidden">Créer</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FileJson className="w-10 sm:w-12 h-10 sm:h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm sm:text-base">{t('programming.noProfiles')}</p>
          <button
            onClick={handleImportClick}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <Upload className="w-4 sm:w-5 h-4 sm:h-5" />
            Importer un profil JSON
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {profiles.map(profile => (
            <div
              key={profile.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">
                      {profile.name}
                    </h3>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      v{profile.version}
                    </span>
                  </div>

                  {/* Labels */}
                  {profile.labels && profile.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {profile.labels.map(label => (
                        <span
                          key={label}
                          className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {profile.created_at && (
                      <span>
                        Créé le {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 sm:ml-4 border-t sm:border-t-0 pt-2 sm:pt-0 -mx-3 px-3 sm:mx-0 sm:px-0">
                  <button
                    onClick={() => handleView(profile)}
                    disabled={actionId === profile.id}
                    className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                    title="Voir les détails"
                  >
                    {actionId === profile.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setDuplicateProfile(profile)
                      setDuplicateName(`${profile.name} (copie)`)
                    }}
                    className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                    title="Dupliquer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExport(profile)}
                    disabled={actionId === profile.id}
                    className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                    title={t('common.export')}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(profile.id)}
                    disabled={actionId === profile.id}
                    className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    title={t('common.delete')}
                  >
                    {actionId === profile.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View modal */}
      {viewProfile && (
        <ProfileViewModal
          profile={viewProfile}
          onClose={() => setViewProfile(null)}
        />
      )}

      {/* Duplicate modal */}
      {duplicateProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Dupliquer le profil
              </h2>
              <button
                onClick={() => {
                  setDuplicateProfile(null)
                  setDuplicateName('')
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom du nouveau profil
                </label>
                <input
                  type="text"
                  value={duplicateName}
                  onChange={e => setDuplicateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setDuplicateProfile(null)
                    setDuplicateName('')
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDuplicate}
                  disabled={!duplicateName.trim() || actionId === duplicateProfile.id}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {actionId === duplicateProfile.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Dupliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
