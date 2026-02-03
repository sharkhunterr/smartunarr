import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import type { EnhancedCriteria } from '@/types'
import { TagInput } from '../common/TagInput'

interface TabEnhancedProps {
  criteria?: EnhancedCriteria
  onChange: (criteria: EnhancedCriteria | undefined) => void
}

type SectionKey = 'keywords' | 'collections' | 'temporal' | 'quality'

export function TabEnhanced({ criteria, onChange }: TabEnhancedProps) {
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>('keywords')

  const current = criteria || {}

  const updateSection = <K extends keyof EnhancedCriteria>(
    section: K,
    value: EnhancedCriteria[K]
  ) => {
    onChange({ ...current, [section]: value })
  }

  const toggleSection = (key: SectionKey) => {
    setExpandedSection(expandedSection === key ? null : key)
  }

  // Keywords Safety
  const keywordsSafety = current.keywords_safety || { enabled: false }
  const updateKeywordsSafety = (field: string, value: unknown) => {
    updateSection('keywords_safety', { ...keywordsSafety, [field]: value })
  }

  // Collections
  const collections = current.collections_franchises || { enabled: false }
  const updateCollections = (field: string, value: unknown) => {
    updateSection('collections_franchises', { ...collections, [field]: value })
  }

  // Temporal
  const temporal = current.temporal_intelligence || { enabled: false }
  const updateTemporal = (field: string, value: unknown) => {
    updateSection('temporal_intelligence', { ...temporal, [field]: value })
  }

  // Quality
  const quality = current.quality_indicators || { enabled: false }
  const updateQuality = (field: string, value: unknown) => {
    updateSection('quality_indicators', { ...quality, [field]: value })
  }

  return (
    <div className="space-y-4">
      {/* Keywords Safety */}
      <Section
        title="Securite mots-cles"
        enabled={keywordsSafety.enabled}
        onToggle={() => updateKeywordsSafety('enabled', !keywordsSafety.enabled)}
        expanded={expandedSection === 'keywords'}
        onExpand={() => toggleSection('keywords')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mots-cles surs (bonus)
            </label>
            <TagInput
              values={keywordsSafety.safe_keywords || []}
              onChange={v => updateKeywordsSafety('safe_keywords', v)}
              suggestions={['family', 'children', 'disney', 'pixar', 'educational', 'adventure', 'friendship']}
              placeholder="Ajouter..."
              color="green"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700 dark:text-gray-300">Bonus:</label>
            <input
              type="number"
              value={keywordsSafety.safe_bonus_points || ''}
              onChange={e => updateKeywordsSafety('safe_bonus_points', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="8"
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mots-cles dangereux (penalite)
            </label>
            <TagInput
              values={keywordsSafety.dangerous_keywords || []}
              onChange={v => updateKeywordsSafety('dangerous_keywords', v)}
              suggestions={['violence', 'gore', 'horror', 'adult', 'sexual', 'drugs', 'alcohol']}
              placeholder="Ajouter..."
              color="red"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700 dark:text-gray-300">Penalite:</label>
            <input
              type="number"
              value={keywordsSafety.dangerous_penalty_points || ''}
              onChange={e => updateKeywordsSafety('dangerous_penalty_points', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="-150"
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
          </div>
        </div>
      </Section>

      {/* Collections & Franchises */}
      <Section
        title="Collections & Franchises"
        enabled={collections.enabled}
        onToggle={() => updateCollections('enabled', !collections.enabled)}
        expanded={expandedSection === 'collections'}
        onExpand={() => toggleSection('collections')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collections preferees
            </label>
            <TagInput
              values={collections.preferred_collections || []}
              onChange={v => updateCollections('preferred_collections', v)}
              suggestions={['Toy Story Collection', 'Finding Nemo Collection', 'Shrek Collection', 'Marvel Cinematic Universe']}
              placeholder="Ajouter..."
              color="green"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700 dark:text-gray-300">Bonus collection:</label>
            <input
              type="number"
              value={collections.collection_bonus_points || ''}
              onChange={e => updateCollections('collection_bonus_points', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="15"
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Franchises preferees
            </label>
            <TagInput
              values={collections.preferred_franchises || []}
              onChange={v => updateCollections('preferred_franchises', v)}
              suggestions={['Disney Princess', 'Pixar', 'DreamWorks', 'Studio Ghibli', 'Illumination']}
              placeholder="Ajouter..."
              color="green"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700 dark:text-gray-300">Bonus franchise:</label>
            <input
              type="number"
              value={collections.franchise_bonus_points || ''}
              onChange={e => updateCollections('franchise_bonus_points', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="10"
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collections interdites
            </label>
            <TagInput
              values={collections.forbidden_collections || []}
              onChange={v => updateCollections('forbidden_collections', v)}
              suggestions={['Saw Collection', 'The Conjuring Universe', 'Halloween Collection']}
              placeholder="Ajouter..."
              color="red"
            />
          </div>
        </div>
      </Section>

      {/* Temporal Intelligence */}
      <Section
        title="Intelligence temporelle"
        enabled={temporal.enabled}
        onToggle={() => updateTemporal('enabled', !temporal.enabled)}
        expanded={expandedSection === 'temporal'}
        onExpand={() => toggleSection('temporal')}
      >
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Bonus nouveaute</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tres recent (jours)</label>
              <input
                type="number"
                value={temporal.recency_bonuses?.very_recent_days || ''}
                onChange={e => updateTemporal('recency_bonuses', {
                  ...temporal.recency_bonuses,
                  very_recent_days: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="90"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bonus tres recent</label>
              <input
                type="number"
                value={temporal.recency_bonuses?.very_recent_bonus || ''}
                onChange={e => updateTemporal('recency_bonuses', {
                  ...temporal.recency_bonuses,
                  very_recent_bonus: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="8"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recent (mois)</label>
              <input
                type="number"
                value={temporal.recency_bonuses?.recent_months || ''}
                onChange={e => updateTemporal('recency_bonuses', {
                  ...temporal.recency_bonuses,
                  recent_months: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="24"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bonus recent</label>
              <input
                type="number"
                value={temporal.recency_bonuses?.recent_bonus || ''}
                onChange={e => updateTemporal('recency_bonuses', {
                  ...temporal.recency_bonuses,
                  recent_bonus: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="5"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Quality Indicators */}
      <Section
        title="Indicateurs de qualite"
        enabled={quality.enabled}
        onToggle={() => updateQuality('enabled', !quality.enabled)}
        expanded={expandedSection === 'quality'}
        onExpand={() => toggleSection('quality')}
      >
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fiabilite des votes</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Excellent (votes)</label>
              <input
                type="number"
                value={quality.vote_reliability?.excellent_votes || ''}
                onChange={e => updateQuality('vote_reliability', {
                  ...quality.vote_reliability,
                  excellent_votes: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="5000"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bon (votes)</label>
              <input
                type="number"
                value={quality.vote_reliability?.good_votes || ''}
                onChange={e => updateQuality('vote_reliability', {
                  ...quality.vote_reliability,
                  good_votes: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="2000"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Acceptable (votes)</label>
              <input
                type="number"
                value={quality.vote_reliability?.acceptable_votes || ''}
                onChange={e => updateQuality('vote_reliability', {
                  ...quality.vote_reliability,
                  acceptable_votes: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="500"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Minimum (votes)</label>
              <input
                type="number"
                value={quality.vote_reliability?.minimum_votes || ''}
                onChange={e => updateQuality('vote_reliability', {
                  ...quality.vote_reliability,
                  minimum_votes: e.target.value ? Number(e.target.value) : undefined
                })}
                placeholder="50"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

// Section component for collapsible sections
interface SectionProps {
  title: string
  enabled: boolean
  onToggle: () => void
  expanded: boolean
  onExpand: () => void
  children: React.ReactNode
}

function Section({ title, enabled, onToggle, expanded, onExpand, children }: SectionProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50">
        <button
          type="button"
          onClick={onExpand}
          className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
          {title}
        </button>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-500">
            {enabled ? 'Active' : 'Desactive'}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className={clsx(
              'relative w-10 h-5 rounded-full transition-colors',
              enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                enabled ? 'left-5' : 'left-0.5'
              )}
            />
          </button>
        </label>
      </div>
      {expanded && (
        <div className={clsx('p-4', !enabled && 'opacity-50 pointer-events-none')}>
          {children}
        </div>
      )}
    </div>
  )
}
