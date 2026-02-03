import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, AlertCircle, CheckCircle, FileJson } from 'lucide-react'
import clsx from 'clsx'
import type { Profile } from '@/types'
import { profilesApi } from '@/services/api'
import { TabInfos } from './tabs/TabInfos'
import { TabLibraries } from './tabs/TabLibraries'
import { TabTimeBlocks } from './tabs/TabTimeBlocks'
import { TabMFPGlobal } from './tabs/TabMFPGlobal'
import { TabScoringWeights } from './tabs/TabScoringWeights'
import { TabEnhanced } from './tabs/TabEnhanced'
import { TabStrategies } from './tabs/TabStrategies'

interface ProfileEditorProps {
  profile?: Profile | null
  onClose: () => void
  onSaved: (profile: Profile) => void
  mode: 'create' | 'edit' | 'duplicate'
}

type TabId = 'infos' | 'libraries' | 'blocks' | 'mfp' | 'weights' | 'enhanced' | 'strategies'

const TAB_IDS: TabId[] = ['infos', 'libraries', 'blocks', 'mfp', 'weights', 'enhanced', 'strategies']

// Templates pre-definis
const TEMPLATES: Record<string, Partial<Profile>> = {
  empty: {
    name: 'Nouveau Profil',
    version: '6.1',
    libraries: [],
    time_blocks: [],
    mandatory_forbidden_criteria: {
      mandatory: {},
      forbidden: { genres: [], age_ratings: [], keywords: [] },
      preferred: { genres: [], keywords: [], collections: [] }
    },
    scoring_weights: {
      type: 10, duration: 10, genre: 15, timing: 10,
      strategy: 5, age: 10, rating: 15, filter: 10, bonus: 5
    },
    default_iterations: 10,
    default_randomness: 0.2,
    labels: []
  },
  kids: {
    name: 'Profil Enfants',
    version: '6.1',
    libraries: [],
    time_blocks: [
      {
        name: 'journee',
        description: 'Journee - Contenus adaptes enfants',
        start_time: '07:00',
        end_time: '21:00',
        criteria: {
          preferred_genres: ['Animation', 'Family', 'Comedy'],
          forbidden_genres: ['Horror', 'Thriller', 'Crime', 'Drama'],
          min_tmdb_rating: 5.5,
          genre_rules: {
            forbidden_values: ['Horror', 'Thriller', 'Crime'],
            forbidden_penalty: -150,
            preferred_values: ['Animation', 'Family'],
            preferred_bonus: 15
          }
        }
      }
    ],
    mandatory_forbidden_criteria: {
      mandatory: { min_tmdb_rating: 5.0 },
      forbidden: {
        genres: ['Horror', 'Horreur'],
        age_ratings: ['R', 'NC-17', '+16', '+18'],
        keywords: ['violence', 'horror', 'adult', 'sexual']
      },
      preferred: { genres: ['Animation', 'Family', 'Comedy'] }
    },
    scoring_weights: {
      type: 8, duration: 8, genre: 18, timing: 10,
      strategy: 4, age: 15, rating: 12, filter: 10, bonus: 5
    },
    default_iterations: 15,
    default_randomness: 0.2,
    labels: ['kids', 'family']
  },
  blockbuster: {
    name: 'Profil Blockbuster',
    version: '6.1',
    libraries: [],
    time_blocks: [
      {
        name: 'prime_time',
        description: 'Prime Time - Films populaires',
        start_time: '20:00',
        end_time: '02:00',
        criteria: {
          preferred_genres: ['Action', 'Adventure', 'Sci-Fi', 'Thriller'],
          min_tmdb_rating: 6.5,
          min_vote_count: 1000,
          rating_rules: {
            preferred_values: ['excellent', 'good'],
            preferred_bonus: 20
          }
        }
      }
    ],
    mandatory_forbidden_criteria: {
      mandatory: { min_tmdb_rating: 6.0, min_vote_count: 500 },
      forbidden: { genres: [], age_ratings: [], keywords: [] },
      preferred: { genres: ['Action', 'Adventure', 'Sci-Fi'] }
    },
    scoring_weights: {
      type: 8, duration: 10, genre: 15, timing: 12,
      strategy: 5, age: 8, rating: 18, filter: 8, bonus: 6
    },
    default_iterations: 20,
    default_randomness: 0.15,
    labels: ['blockbuster', 'popular']
  }
}

const DEFAULT_PROFILE: Profile = {
  id: '',
  name: '',
  version: '6.1',
  libraries: [],
  time_blocks: [],
  mandatory_forbidden_criteria: {
    mandatory: {},
    forbidden: { genres: [], age_ratings: [], keywords: [] },
    preferred: { genres: [], keywords: [], collections: [] }
  },
  scoring_weights: {
    type: 10, duration: 10, genre: 15, timing: 10,
    strategy: 5, age: 10, rating: 15, filter: 10, bonus: 5
  },
  default_iterations: 10,
  default_randomness: 0.2,
  labels: []
}

export function ProfileEditor({ profile, onClose, onSaved, mode }: ProfileEditorProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabId>('infos')
  const [formData, setFormData] = useState<Profile>(DEFAULT_PROFILE)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [showJson, setShowJson] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && profile) {
      setFormData({ ...profile })
    } else if (mode === 'duplicate' && profile) {
      setFormData({
        ...profile,
        id: '',
        name: `${profile.name} (copie)`,
        created_at: undefined,
        updated_at: undefined
      })
    } else {
      setFormData({ ...DEFAULT_PROFILE, ...TEMPLATES.empty })
    }
  }, [profile, mode])

  // Update form field
  const updateField = useCallback(<K extends keyof Profile>(field: K, value: Profile[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  // Apply template
  const applyTemplate = useCallback((templateKey: string) => {
    const template = TEMPLATES[templateKey]
    if (template) {
      setFormData(prev => ({
        ...prev,
        ...template,
        id: prev.id // Keep existing ID if editing
      }))
      setHasChanges(true)
    }
  }, [])

  // Validate profile
  const validateProfile = useCallback(async () => {
    setValidating(true)
    setErrors([])
    setWarnings([])

    try {
      // Local validation
      const localErrors: string[] = []
      const localWarnings: string[] = []

      if (!formData.name.trim()) {
        localErrors.push(t('profiles.editor.nameRequired'))
      }
      if (formData.time_blocks.length === 0) {
        localWarnings.push(t('profiles.editor.noTimeBlocks'))
      }
      if (formData.libraries.length === 0) {
        localWarnings.push(t('profiles.editor.noLibraries'))
      }

      // Check time block overlaps
      const blocks = [...formData.time_blocks].sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      )
      for (let i = 0; i < blocks.length - 1; i++) {
        const current = blocks[i]
        const next = blocks[i + 1]
        if (current.end_time > next.start_time && current.end_time !== '00:00') {
          localWarnings.push(t('profiles.editor.blockOverlap', { block1: current.name, block2: next.name }))
        }
      }

      // API validation
      const result = await profilesApi.validate(formData as unknown as Record<string, unknown>)

      setErrors([...localErrors, ...result.errors])
      setWarnings([...localWarnings, ...result.warnings])

      return localErrors.length === 0 && result.errors.length === 0
    } catch (err) {
      setErrors([t('profiles.editor.errorValidation')])
      return false
    } finally {
      setValidating(false)
    }
  }, [formData, t])

  // Save profile
  const handleSave = useCallback(async () => {
    const isValid = await validateProfile()
    if (!isValid) return

    setSaving(true)
    try {
      let savedProfile: Profile

      if (mode === 'edit' && formData.id) {
        savedProfile = await profilesApi.update(formData.id, formData)
      } else {
        // Create or duplicate - use import endpoint
        savedProfile = await profilesApi.import(
          formData as unknown as Record<string, unknown>,
          false
        )
      }

      onSaved(savedProfile)
      onClose()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('profiles.editor.errorSaving')
      setErrors([errorMessage])
    } finally {
      setSaving(false)
    }
  }, [formData, mode, validateProfile, onSaved, onClose, t])

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'infos':
        return (
          <TabInfos
            formData={formData}
            updateField={updateField}
            applyTemplate={applyTemplate}
            templates={Object.keys(TEMPLATES)}
            mode={mode}
          />
        )
      case 'libraries':
        return (
          <TabLibraries
            libraries={formData.libraries}
            onChange={(libs) => updateField('libraries', libs)}
          />
        )
      case 'blocks':
        return (
          <TabTimeBlocks
            timeBlocks={formData.time_blocks}
            onChange={(blocks) => updateField('time_blocks', blocks)}
          />
        )
      case 'mfp':
        return (
          <TabMFPGlobal
            criteria={formData.mandatory_forbidden_criteria}
            onChange={(mfp) => updateField('mandatory_forbidden_criteria', mfp)}
          />
        )
      case 'weights':
        return (
          <TabScoringWeights
            weights={formData.scoring_weights}
            mfpPolicy={formData.mfp_policy}
            multipliers={formData.criterion_multipliers}
            onWeightsChange={(w) => updateField('scoring_weights', w)}
            onMfpPolicyChange={(p) => updateField('mfp_policy', p)}
            onMultipliersChange={(m) => updateField('criterion_multipliers', m)}
          />
        )
      case 'enhanced':
        return (
          <TabEnhanced
            criteria={formData.enhanced_criteria}
            onChange={(ec) => updateField('enhanced_criteria', ec)}
          />
        )
      case 'strategies':
        return (
          <TabStrategies
            strategies={formData.strategies}
            onChange={(s) => updateField('strategies', s)}
          />
        )
      default:
        return null
    }
  }

  const title = mode === 'create'
    ? t('profiles.editor.createTitle')
    : mode === 'duplicate'
      ? t('profiles.editor.duplicateTitle')
      : t('profiles.editor.editTitle', { name: profile?.name || '' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full h-full max-w-6xl max-h-[95vh] m-2 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {hasChanges && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                {t('profiles.editor.unsaved')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJson(!showJson)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                showJson
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              title={t('profiles.editor.viewJson')}
            >
              <FileJson className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 overflow-x-auto">
          {TAB_IDS.map(tabId => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                activeTab === tabId
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <span className="hidden sm:inline">{t(`profiles.tabs.${tabId}`)}</span>
              <span className="sm:hidden">{t(`profiles.tabs.${tabId}Short`)}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <div className={clsx(
            'flex-1 overflow-y-auto p-4',
            showJson ? 'w-1/2' : 'w-full'
          )}>
            {renderTabContent()}
          </div>

          {/* JSON Preview */}
          {showJson && (
            <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-900 p-4">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(formData, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Errors & Warnings */}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 space-y-1 max-h-32 overflow-y-auto">
            {errors.map((err, i) => (
              <div key={`err-${i}`} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{err}</span>
              </div>
            ))}
            {warnings.map((warn, i) => (
              <div key={`warn-${i}`} className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={validateProfile}
              disabled={validating}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {validating ? t('profiles.editor.validating') : t('profiles.editor.validate')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || errors.length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('profiles.editor.saving') : t('profiles.editor.saveBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
