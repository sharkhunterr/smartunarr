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
  Clock,
  FileJson
} from 'lucide-react'
import { profilesApi } from '@/services/api'
import type { Profile, TimeBlock, ScoringWeights } from '@/types'
import { ProfileEditor } from '@/components/profile'

interface ProfileModalProps {
  profile: Profile | null
  onClose: () => void
}

// Color palette for labels
const LABEL_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  kids: { bg: 'bg-pink-100', text: 'text-pink-700', darkBg: 'dark:bg-pink-900/30', darkText: 'dark:text-pink-400' },
  family: { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-400' },
  blockbuster: { bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'dark:bg-amber-900/30', darkText: 'dark:text-amber-400' },
  popular: { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
  animation: { bg: 'bg-cyan-100', text: 'text-cyan-700', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-400' },
  action: { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
  comedy: { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'dark:bg-yellow-900/30', darkText: 'dark:text-yellow-400' },
  drama: { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400' },
  horror: { bg: 'bg-gray-800', text: 'text-gray-100', darkBg: 'dark:bg-gray-900', darkText: 'dark:text-gray-300' },
  scifi: { bg: 'bg-indigo-100', text: 'text-indigo-700', darkBg: 'dark:bg-indigo-900/30', darkText: 'dark:text-indigo-400' },
  night: { bg: 'bg-slate-700', text: 'text-slate-100', darkBg: 'dark:bg-slate-800', darkText: 'dark:text-slate-300' },
  prime: { bg: 'bg-emerald-100', text: 'text-emerald-700', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
}

function getLabelColor(label: string): string {
  const lowerLabel = label.toLowerCase()
  for (const [key, colors] of Object.entries(LABEL_COLORS)) {
    if (lowerLabel.includes(key)) {
      return `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText}`
    }
  }
  // Default color based on hash
  const hash = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colorKeys = Object.keys(LABEL_COLORS)
  const defaultKey = colorKeys[hash % colorKeys.length]
  const colors = LABEL_COLORS[defaultKey]
  return `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText}`
}

function ProfileViewModal({ profile, onClose }: ProfileModalProps) {
  const { t } = useTranslation()

  if (!profile) return null

  const mfp = profile.mandatory_forbidden_criteria
  const hasMfp = mfp && (
    Object.keys(mfp.mandatory || {}).length > 0 ||
    (mfp.forbidden?.genres?.length || 0) > 0 ||
    (mfp.forbidden?.keywords?.length || 0) > 0 ||
    (mfp.preferred?.genres?.length || 0) > 0
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-750">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {profile.name}
            </h2>
            <span className="px-2 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              v{profile.version}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Labels + Quick Stats Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Labels */}
            {profile.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.labels.map(label => (
                  <span
                    key={label}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full ${getLabelColor(label)}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            {/* Quick stats */}
            <div className="flex items-center gap-3 ml-auto text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {profile.time_blocks.length} blocs
              </span>
              <span>{profile.default_iterations} iter.</span>
              <span>{(profile.default_randomness * 100).toFixed(0)}% rand.</span>
            </div>
          </div>

          {/* Time Blocks - Compact */}
          {profile.time_blocks.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Blocs horaires
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {profile.time_blocks.map((block: TimeBlock, index: number) => (
                  <div
                    key={index}
                    className="px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {block.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {block.start_time} → {block.end_time}
                    </div>
                    {block.criteria.preferred_genres && block.criteria.preferred_genres.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {block.criteria.preferred_genres.slice(0, 2).map(g => (
                          <span key={g} className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            {g}
                          </span>
                        ))}
                        {block.criteria.preferred_genres.length > 2 && (
                          <span className="text-[10px] text-gray-400">+{block.criteria.preferred_genres.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* M/F/P Summary - Compact */}
          {hasMfp && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Criteres M/F/P
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                {mfp.mandatory && Object.keys(mfp.mandatory).length > 0 && (
                  <div>
                    <span className="text-orange-600 dark:text-orange-400 font-medium">Mandatory: </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {Object.entries(mfp.mandatory).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </span>
                  </div>
                )}
                {mfp.forbidden?.genres && mfp.forbidden.genres.length > 0 && (
                  <div>
                    <span className="text-red-600 dark:text-red-400 font-medium">Forbidden genres: </span>
                    <span className="text-gray-700 dark:text-gray-300">{mfp.forbidden.genres.join(', ')}</span>
                  </div>
                )}
                {mfp.forbidden?.keywords && mfp.forbidden.keywords.length > 0 && (
                  <div>
                    <span className="text-red-600 dark:text-red-400 font-medium">Forbidden keywords: </span>
                    <span className="text-gray-700 dark:text-gray-300">{mfp.forbidden.keywords.slice(0, 5).join(', ')}{mfp.forbidden.keywords.length > 5 ? ` +${mfp.forbidden.keywords.length - 5}` : ''}</span>
                  </div>
                )}
                {mfp.preferred?.genres && mfp.preferred.genres.length > 0 && (
                  <div>
                    <span className="text-green-600 dark:text-green-400 font-medium">Preferred genres: </span>
                    <span className="text-gray-700 dark:text-gray-300">{mfp.preferred.genres.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scoring Weights - Inline */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Poids de scoring
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.scoring_weights as ScoringWeights).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                >
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t(`scoring.criteria.${key}`)}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Libraries - Compact */}
          {profile.libraries.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Bibliotheques ({profile.libraries.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.libraries.map((lib, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700"
                  >
                    {lib.name}
                    <span className="text-gray-400 dark:text-gray-500">({lib.weight})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* JSON Toggle */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
              <FileJson className="w-3.5 h-3.5" />
              Voir le JSON brut
            </summary>
            <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-[10px] font-mono rounded-lg overflow-x-auto max-h-64">
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

  // Editor state
  const [editorProfile, setEditorProfile] = useState<Profile | null>(null)
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'duplicate'>('create')
  const [showEditor, setShowEditor] = useState(false)

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

  const handleCreate = () => {
    setEditorProfile(null)
    setEditorMode('create')
    setShowEditor(true)
  }

  const handleEdit = async (profile: Profile) => {
    setActionId(profile.id)
    try {
      const fullProfile = await profilesApi.get(profile.id)
      setEditorProfile(fullProfile)
      setEditorMode('edit')
      setShowEditor(true)
    } catch {
      setError('Erreur lors du chargement du profil')
    } finally {
      setActionId(null)
    }
  }

  const handleEditorSave = (savedProfile: Profile) => {
    if (editorMode === 'edit') {
      setProfiles(prev => prev.map(p => p.id === savedProfile.id ? savedProfile : p))
    } else {
      setProfiles(prev => [...prev, savedProfile])
    }
    setSuccess(editorMode === 'edit' ? 'Profil mis a jour' : 'Profil cree')
    setShowEditor(false)
  }

  const handleEditorClose = () => {
    setShowEditor(false)
    setEditorProfile(null)
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
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="hidden sm:inline">{t('profiles.create')}</span>
            <span className="sm:hidden">Creer</span>
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
                          className={`px-2 py-0.5 text-xs font-medium rounded ${getLabelColor(label)}`}
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
                    onClick={() => handleEdit(profile)}
                    disabled={actionId === profile.id}
                    className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                    title={t('common.edit')}
                  >
                    {actionId === profile.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Edit className="w-4 h-4" />
                    )}
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

      {/* Profile Editor */}
      {showEditor && (
        <ProfileEditor
          profile={editorProfile}
          mode={editorMode}
          onClose={handleEditorClose}
          onSaved={handleEditorSave}
        />
      )}
    </div>
  )
}
