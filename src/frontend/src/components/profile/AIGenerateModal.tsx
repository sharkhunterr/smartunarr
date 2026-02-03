import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  FileJson,
  Save,
  Library,
  Check
} from 'lucide-react'
import { aiApi, ollamaApi, profilesApi, plexApi } from '@/services/api'
import type { AIGenerateProfileResponse, AIModelInfo, Profile, OllamaModel, PlexLibrary, AILibraryInfo } from '@/types'

interface AIGenerateModalProps {
  onClose: () => void
  onProfileGenerated: (profile: Profile) => void
}

type GenerationStep = 'idle' | 'generating' | 'validating' | 'success' | 'error'

export function AIGenerateModal({ onClose, onProfileGenerated }: AIGenerateModalProps) {
  const { t } = useTranslation()

  // Form state
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [temperature, setTemperature] = useState(0.3)
  const [profileName, setProfileName] = useState('')

  // Generation state
  const [step, setStep] = useState<GenerationStep>('idle')
  const [result, setResult] = useState<AIGenerateProfileResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Models state
  const [models, setModels] = useState<AIModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [recommendedModel, setRecommendedModel] = useState<string>('')

  // Libraries state
  const [libraries, setLibraries] = useState<PlexLibrary[]>([])
  const [selectedLibraries, setSelectedLibraries] = useState<Set<string>>(new Set())
  const [loadingLibraries, setLoadingLibraries] = useState(true)

  // UI state
  const [showDetails, setShowDetails] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [importing, setImporting] = useState(false)

  // Load available models and libraries
  useEffect(() => {
    loadModels()
    loadLibraries()
  }, [])

  const loadLibraries = async () => {
    try {
      const plexLibraries = await plexApi.getLibraries()
      setLibraries(plexLibraries)
      // Select all libraries by default
      setSelectedLibraries(new Set(plexLibraries.map(lib => lib.id)))
    } catch (err) {
      console.error('Failed to load libraries:', err)
      // Not critical, just won't show library selection
    } finally {
      setLoadingLibraries(false)
    }
  }

  const loadModels = async () => {
    setModelsError(null)
    try {
      // Try AI API first
      const response = await aiApi.getModels()
      setModels(response.available_models)
      setRecommendedModel(response.recommended.profile_generation)
      // Auto-select first model if available
      if (response.available_models.length > 0) {
        setSelectedModel(response.recommended.profile_generation || response.available_models[0].name)
      }
    } catch {
      // Fallback to Ollama API
      try {
        const ollamaModels: OllamaModel[] = await ollamaApi.getModels()
        const converted: AIModelInfo[] = ollamaModels.map(m => ({
          name: m.name || m.model,
          size: m.size,
          modified_at: m.modified_at
        }))
        setModels(converted)
        if (converted.length > 0) {
          setSelectedModel(converted[0].name)
        }
      } catch (fallbackErr) {
        console.error('Failed to load models:', fallbackErr)
        setModelsError(t('ai.modelsLoadError'))
      }
    } finally {
      setLoadingModels(false)
    }
  }

  const toggleLibrary = (libraryId: string) => {
    setSelectedLibraries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(libraryId)) {
        newSet.delete(libraryId)
      } else {
        newSet.add(libraryId)
      }
      return newSet
    })
  }

  const toggleAllLibraries = () => {
    if (selectedLibraries.size === libraries.length) {
      setSelectedLibraries(new Set())
    } else {
      setSelectedLibraries(new Set(libraries.map(lib => lib.id)))
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setStep('generating')
    setError(null)
    setResult(null)

    // Build libraries info for AI context
    const librariesInfo: AILibraryInfo[] = libraries
      .filter(lib => selectedLibraries.has(lib.id))
      .map(lib => ({
        id: lib.id,
        name: lib.title,
        type: lib.type
      }))

    try {
      const response = await aiApi.generateProfile({
        prompt: prompt.trim(),
        model: selectedModel || undefined,
        temperature,
        save_profile: false, // We'll import manually to have control
        profile_name: profileName || undefined,
        libraries: librariesInfo.length > 0 ? librariesInfo : undefined
      })

      setResult(response)

      if (response.success) {
        setStep('success')
        // Auto-fill profile name from generated profile if not set
        if (!profileName && response.profile?.name) {
          setProfileName(response.profile.name as string)
        }
      } else {
        setStep('error')
        setError(response.error_message || t('ai.generationFailed'))
      }
    } catch (err: unknown) {
      setStep('error')
      const errorMessage = err instanceof Error ? err.message : t('common.errors.generation')
      setError(errorMessage)
    }
  }

  const handleImport = async () => {
    if (!result?.profile) return

    setImporting(true)
    setError(null)

    try {
      // Validate first
      const validation = await profilesApi.validate(result.profile)
      if (!validation.valid) {
        setError(`${t('profiles.invalidJson')}: ${validation.errors.join(', ')}`)
        setImporting(false)
        return
      }

      // Add name if provided
      const profileData = {
        ...result.profile,
        name: profileName || result.profile.name || 'AI Generated Profile',
        labels: [...((result.profile.labels as string[]) || []), 'ai-generated']
      }

      // Import
      const importedProfile = await profilesApi.import(profileData, false)
      onProfileGenerated(importedProfile)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('profiles.errorImporting')
      setError(errorMessage)
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setStep('idle')
    setResult(null)
    setError(null)
    setShowDetails(false)
    setShowJson(false)
  }

  const canGenerate = prompt.trim().length >= 10 && step !== 'generating' && selectedModel && models.length > 0
  const canImport = result?.success && result.profile && profileName.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('ai.generateProfile')}
              </h2>
              {/* Experimental badge */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {t('ai.experimental')}
                </span>
              </div>
            </div>
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
          {/* Experimental warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">{t('ai.experimentalWarning')}</p>
              <p className="mt-1 text-amber-600 dark:text-amber-400">{t('ai.experimentalDescription')}</p>
            </div>
          </div>

          {step === 'idle' || step === 'generating' ? (
            <>
              {/* Generation in progress message */}
              {step === 'generating' && (
                <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin flex-shrink-0" />
                  <div>
                    <p className="font-medium text-purple-700 dark:text-purple-400">
                      {t('ai.generatingInProgress')}
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-500 mt-0.5">
                      {t('ai.generatingHint')}
                    </p>
                  </div>
                </div>
              )}

              {/* Prompt input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('ai.prompt')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={t('ai.promptPlaceholder')}
                  rows={4}
                  disabled={step === 'generating'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 resize-none"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('ai.promptHint')}
                </p>
              </div>

              {/* Model selection */}
              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('ai.model')} <span className="text-red-500">*</span>
                    </label>
                    {loadingModels ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('common.loading')}
                      </div>
                    ) : modelsError ? (
                      <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        {modelsError}
                      </div>
                    ) : models.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        {t('ai.noModelsAvailable')}
                      </div>
                    ) : (
                      <select
                        value={selectedModel}
                        onChange={e => setSelectedModel(e.target.value)}
                        disabled={step === 'generating'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        {models.map(model => (
                          <option key={model.name} value={model.name}>
                            {model.name}
                            {model.name === recommendedModel && ` (${t('ai.recommended')})`}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedModel && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('ai.selectedModel')}: <span className="font-mono">{selectedModel}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('ai.temperature')}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={temperature}
                        onChange={e => setTemperature(parseFloat(e.target.value))}
                        disabled={step === 'generating'}
                        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-8">
                        {temperature.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('ai.temperatureHint')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Library selection */}
              {libraries.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Library className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('ai.libraries')}
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAllLibraries}
                      disabled={step === 'generating'}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50"
                    >
                      {selectedLibraries.size === libraries.length ? t('ai.deselectAll') : t('ai.selectAll')}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {t('ai.librariesHint')}
                  </p>
                  {loadingLibraries ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.loading')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {libraries.map(library => (
                        <label
                          key={library.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                            selectedLibraries.has(library.id)
                              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          } ${step === 'generating' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center ${
                            selectedLibraries.has(library.id)
                              ? 'bg-purple-500 text-white'
                              : 'border border-gray-300 dark:border-gray-600'
                          }`}>
                            {selectedLibraries.has(library.id) && <Check className="w-3 h-3" />}
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedLibraries.has(library.id)}
                            onChange={() => toggleLibrary(library.id)}
                            disabled={step === 'generating'}
                            className="sr-only"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900 dark:text-white truncate block">
                              {library.title}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {library.type}
                              {library.count && ` • ${library.count} items`}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedLibraries.size === 0 && !loadingLibraries && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      {t('ai.noLibrariesSelected')}
                    </p>
                  )}
                </div>
              )}

              {/* Examples */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('ai.examplePrompts')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {['actionNight', 'familyWeekend', 'classicMovies', 'lateNight'].map(key => (
                    <button
                      key={key}
                      onClick={() => setPrompt(t(`ai.exampleValues.${key}`))}
                      disabled={step === 'generating'}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-400 transition-colors disabled:opacity-50"
                    >
                      {t(`ai.examples.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Result display */
            <div className="space-y-4">
              {/* Status */}
              <div className={`flex items-center gap-3 p-4 rounded-lg ${
                step === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                {step === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500" />
                )}
                <div>
                  <p className={`font-medium ${
                    step === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                  }`}>
                    {step === 'success' ? t('ai.generationSuccess') : t('ai.generationFailed')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('ai.attempts', { count: result?.total_attempts || 0 })}
                  </p>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Attempts details */}
              {result && result.attempts.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {t('ai.attemptDetails')}
                  </button>
                  {showDetails && (
                    <div className="mt-2 space-y-2">
                      {result.attempts.map((attempt, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            attempt.success
                              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {attempt.success ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {t('ai.attempt')} {attempt.attempt_number}
                            </span>
                          </div>
                          {attempt.validation_errors.length > 0 && (
                            <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                              {attempt.validation_errors.map((err, errIdx) => (
                                <li key={errIdx}>{err}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Generated profile preview */}
              {result?.profile && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('ai.generatedProfile')}
                    </span>
                    <button
                      onClick={() => setShowJson(!showJson)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <FileJson className="w-3.5 h-3.5" />
                      {showJson ? t('ai.hideJson') : t('ai.showJson')}
                    </button>
                  </div>

                  {/* Profile summary */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('profiles.name')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {result.profile.name as string}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">{t('profiles.timeBlocks')}:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {(result.profile.time_blocks as unknown[])?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* JSON preview */}
                  {showJson && (
                    <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-[10px] font-mono rounded-lg overflow-x-auto max-h-48">
                      {JSON.stringify(result.profile, null, 2)}
                    </pre>
                  )}

                  {/* Import form */}
                  <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('ai.profileName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder={t('ai.profileNamePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={step === 'idle' || step === 'generating' ? onClose : handleReset}
            disabled={step === 'generating'}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {step === 'idle' || step === 'generating' ? t('common.cancel') : t('ai.newGeneration')}
          </button>

          <div className="flex items-center gap-2">
            {(step === 'success' || step === 'error') && result?.profile && (
              <button
                onClick={handleImport}
                disabled={!canImport || importing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {t('ai.importProfile')}
              </button>
            )}

            {(step === 'idle' || step === 'generating') && (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {step === 'generating' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {step === 'generating' ? t('ai.generating') : t('ai.generate')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
