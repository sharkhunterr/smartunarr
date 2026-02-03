import { useState } from 'react'
import { Plus, Edit2, Copy, Trash2, Clock, ChevronDown, ChevronUp, X } from 'lucide-react'
import clsx from 'clsx'
import type { TimeBlock, BlockCriteria } from '@/types'
import { TagInput } from '../common/TagInput'
import { MFPRuleEditor } from '../common/MFPRuleEditor'

interface TabTimeBlocksProps {
  timeBlocks: TimeBlock[]
  onChange: (blocks: TimeBlock[]) => void
}

const DEFAULT_BLOCK: TimeBlock = {
  name: 'nouveau_bloc',
  description: '',
  start_time: '08:00',
  end_time: '12:00',
  criteria: {
    preferred_genres: [],
    forbidden_genres: [],
    min_duration_min: 60,
    max_duration_min: 180
  }
}

export function TabTimeBlocks({ timeBlocks, onChange }: TabTimeBlocksProps) {
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null)

  const addBlock = () => {
    const newBlock = {
      ...DEFAULT_BLOCK,
      name: `bloc_${timeBlocks.length + 1}`
    }
    setEditingBlock(newBlock)
    setEditingIndex(null)
  }

  const editBlock = (block: TimeBlock, index: number) => {
    setEditingBlock({ ...block })
    setEditingIndex(index)
  }

  const duplicateBlock = (block: TimeBlock) => {
    const newBlock = {
      ...block,
      name: `${block.name}_copy`
    }
    onChange([...timeBlocks, newBlock])
  }

  const deleteBlock = (index: number) => {
    onChange(timeBlocks.filter((_, i) => i !== index))
  }

  const saveBlock = () => {
    if (!editingBlock) return

    if (editingIndex !== null) {
      onChange(timeBlocks.map((b, i) => i === editingIndex ? editingBlock : b))
    } else {
      onChange([...timeBlocks, editingBlock])
    }
    setEditingBlock(null)
    setEditingIndex(null)
  }

  const formatTime = (time: string) => time

  const getBlockDuration = (block: TimeBlock) => {
    const [startH, startM] = block.start_time.split(':').map(Number)
    const [endH, endM] = block.end_time.split(':').map(Number)
    let startMins = startH * 60 + startM
    let endMins = endH * 60 + endM
    if (endMins <= startMins) endMins += 24 * 60 // overnight
    return Math.round((endMins - startMins) / 60)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Blocs horaires ({timeBlocks.length})
        </h3>
        <button
          onClick={addBlock}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Blocks List */}
      <div className="space-y-2">
        {timeBlocks.map((block, index) => (
          <div
            key={`${block.name}-${index}`}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Block Header */}
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              onClick={() => setExpandedBlock(expandedBlock === index ? null : index)}
            >
              <Clock className="w-4 h-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {block.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    {formatTime(block.start_time)} - {formatTime(block.end_time)}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({getBlockDuration(block)}h)
                  </span>
                </div>
                {block.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {block.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); editBlock(block, index) }}
                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Editer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateBlock(block) }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Dupliquer"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteBlock(index) }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedBlock === index ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedBlock === index && (
              <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
                <BlockCriteriaSummary criteria={block.criteria} />
              </div>
            )}
          </div>
        ))}
      </div>

      {timeBlocks.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun bloc horaire defini</p>
          <p className="text-sm">Cliquez sur "Ajouter" pour creer votre premier bloc</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingBlock && (
        <BlockEditorModal
          block={editingBlock}
          onChange={setEditingBlock}
          onSave={saveBlock}
          onClose={() => { setEditingBlock(null); setEditingIndex(null) }}
          isNew={editingIndex === null}
        />
      )}
    </div>
  )
}

// Summary of block criteria
function BlockCriteriaSummary({ criteria }: { criteria: BlockCriteria }) {
  return (
    <div className="pt-3 space-y-2 text-xs">
      {criteria.preferred_genres && criteria.preferred_genres.length > 0 && (
        <div className="flex gap-2">
          <span className="text-gray-500 w-20">Preferes:</span>
          <div className="flex flex-wrap gap-1">
            {criteria.preferred_genres.map(g => (
              <span key={g} className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
      {criteria.forbidden_genres && criteria.forbidden_genres.length > 0 && (
        <div className="flex gap-2">
          <span className="text-gray-500 w-20">Interdits:</span>
          <div className="flex flex-wrap gap-1">
            {criteria.forbidden_genres.map(g => (
              <span key={g} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-4 text-gray-600 dark:text-gray-400">
        {criteria.min_duration_min && <span>Min: {criteria.min_duration_min}min</span>}
        {criteria.max_duration_min && <span>Max: {criteria.max_duration_min}min</span>}
        {criteria.min_tmdb_rating && <span>Note min: {criteria.min_tmdb_rating}</span>}
      </div>
    </div>
  )
}

// Modal for editing a single block
interface BlockEditorModalProps {
  block: TimeBlock
  onChange: (block: TimeBlock) => void
  onSave: () => void
  onClose: () => void
  isNew: boolean
}

type BlockTab = 'general' | 'genres' | 'age' | 'filter' | 'rating' | 'timing' | 'mfp'

function BlockEditorModal({ block, onChange, onSave, onClose, isNew }: BlockEditorModalProps) {
  const [activeTab, setActiveTab] = useState<BlockTab>('general')

  const updateField = <K extends keyof TimeBlock>(field: K, value: TimeBlock[K]) => {
    onChange({ ...block, [field]: value })
  }

  const updateCriteria = <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => {
    onChange({
      ...block,
      criteria: { ...block.criteria, [field]: value }
    })
  }

  const tabs: { id: BlockTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'genres', label: 'Genres' },
    { id: 'age', label: 'Age' },
    { id: 'filter', label: 'Filtres' },
    { id: 'rating', label: 'Notes' },
    { id: 'timing', label: 'Timing' },
    { id: 'mfp', label: 'MFP' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[90vh] m-4 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isNew ? 'Nouveau bloc horaire' : `Editer: ${block.name}`}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'general' && (
            <GeneralTab block={block} updateField={updateField} updateCriteria={updateCriteria} />
          )}
          {activeTab === 'genres' && (
            <GenresTab criteria={block.criteria} updateCriteria={updateCriteria} />
          )}
          {activeTab === 'age' && (
            <AgeTab criteria={block.criteria} updateCriteria={updateCriteria} />
          )}
          {activeTab === 'filter' && (
            <FilterTab criteria={block.criteria} updateCriteria={updateCriteria} />
          )}
          {activeTab === 'rating' && (
            <RatingTab criteria={block.criteria} updateCriteria={updateCriteria} />
          )}
          {activeTab === 'timing' && (
            <TimingTab criteria={block.criteria} updateCriteria={updateCriteria} />
          )}
          {activeTab === 'mfp' && (
            <MFPTab criteria={block.criteria} updateCriteria={updateCriteria} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            {isNew ? 'Creer' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Tab Components
function GeneralTab({ block, updateField, updateCriteria }: {
  block: TimeBlock
  updateField: <K extends keyof TimeBlock>(field: K, value: TimeBlock[K]) => void
  updateCriteria: <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nom du bloc *
          </label>
          <input
            type="text"
            value={block.name}
            onChange={e => updateField('name', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={block.description || ''}
            onChange={e => updateField('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Heure de debut
          </label>
          <input
            type="time"
            value={block.start_time}
            onChange={e => updateField('start_time', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Heure de fin
          </label>
          <input
            type="time"
            value={block.end_time}
            onChange={e => updateField('end_time', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Duree minimum (min)
          </label>
          <input
            type="number"
            value={block.criteria.min_duration_min || ''}
            onChange={e => updateCriteria('min_duration_min', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Duree maximum (min)
          </label>
          <input
            type="number"
            value={block.criteria.max_duration_min || ''}
            onChange={e => updateCriteria('max_duration_min', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Note TMDB minimum
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="10"
            value={block.criteria.min_tmdb_rating || ''}
            onChange={e => updateCriteria('min_tmdb_rating', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Votes minimum
          </label>
          <input
            type="number"
            value={block.criteria.min_vote_count || ''}
            onChange={e => updateCriteria('min_vote_count', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </div>
  )
}

function GenresTab({ criteria, updateCriteria }: {
  criteria: BlockCriteria
  updateCriteria: <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => void
}) {
  const COMMON_GENRES = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
    'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'
  ]

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Genres preferes
        </label>
        <TagInput
          values={criteria.preferred_genres || []}
          onChange={v => updateCriteria('preferred_genres', v)}
          suggestions={COMMON_GENRES}
          placeholder="Ajouter un genre..."
          color="green"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Genres interdits
        </label>
        <TagInput
          values={criteria.forbidden_genres || []}
          onChange={v => updateCriteria('forbidden_genres', v)}
          suggestions={COMMON_GENRES}
          placeholder="Ajouter un genre..."
          color="red"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Regles M/F/P pour les genres
        </label>
        <MFPRuleEditor
          rule={criteria.genre_rules}
          onChange={r => updateCriteria('genre_rules', r)}
          suggestions={COMMON_GENRES}
        />
      </div>
    </div>
  )
}

function AgeTab({ criteria, updateCriteria }: {
  criteria: BlockCriteria
  updateCriteria: <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => void
}) {
  const AGE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TP', 'Tous publics', '+10', '+12', '+16', '+18']

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Classification max
        </label>
        <select
          value={criteria.max_age_rating || ''}
          onChange={e => updateCriteria('max_age_rating', e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Non defini</option>
          {AGE_RATINGS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Classifications autorisees
        </label>
        <TagInput
          values={criteria.allowed_age_ratings || []}
          onChange={v => updateCriteria('allowed_age_ratings', v)}
          suggestions={AGE_RATINGS}
          placeholder="Ajouter..."
          color="blue"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Regles M/F/P pour l'age
        </label>
        <MFPRuleEditor
          rule={criteria.age_rules}
          onChange={r => updateCriteria('age_rules', r)}
          suggestions={AGE_RATINGS}
        />
      </div>
    </div>
  )
}

function FilterTab({ criteria, updateCriteria }: {
  criteria: BlockCriteria
  updateCriteria: <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => void
}) {
  const FILTER_KEYWORDS = [
    'violence', 'gore', 'blood', 'horror', 'scary', 'adult', 'sexual', 'nude',
    'drugs', 'alcohol', 'smoking', 'family', 'children', 'disney', 'pixar'
  ]

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mots-cles a exclure
        </label>
        <TagInput
          values={criteria.exclude_keywords || []}
          onChange={v => updateCriteria('exclude_keywords', v)}
          suggestions={FILTER_KEYWORDS}
          placeholder="Ajouter..."
          color="red"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mots-cles a inclure
        </label>
        <TagInput
          values={criteria.include_keywords || []}
          onChange={v => updateCriteria('include_keywords', v)}
          suggestions={FILTER_KEYWORDS}
          placeholder="Ajouter..."
          color="green"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Regles M/F/P pour les filtres
        </label>
        <MFPRuleEditor
          rule={criteria.filter_rules}
          onChange={r => updateCriteria('filter_rules', r)}
          suggestions={FILTER_KEYWORDS}
        />
      </div>
    </div>
  )
}

function RatingTab({ criteria, updateCriteria }: {
  criteria: BlockCriteria
  updateCriteria: <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => void
}) {
  const RATING_VALUES = ['excellent', 'good', 'average', 'poor']

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Regles M/F/P pour les notes
        </label>
        <MFPRuleEditor
          rule={criteria.rating_rules}
          onChange={r => updateCriteria('rating_rules', r)}
          suggestions={RATING_VALUES}
        />
      </div>
    </div>
  )
}

function TimingTab({ criteria, updateCriteria }: {
  criteria: BlockCriteria
  updateCriteria: <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => void
}) {
  const timingRules = criteria.timing_rules || {}

  const updateTimingRule = (field: string, value: number | undefined) => {
    updateCriteria('timing_rules', { ...timingRules, [field]: value })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Decalage prefere max (min)
          </label>
          <input
            type="number"
            value={timingRules.preferred_max_minutes || ''}
            onChange={e => updateTimingRule('preferred_max_minutes', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Bonus si decalage &lt; cette valeur</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bonus prefere
          </label>
          <input
            type="number"
            value={timingRules.preferred_bonus || ''}
            onChange={e => updateTimingRule('preferred_bonus', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Decalage obligatoire max (min)
          </label>
          <input
            type="number"
            value={timingRules.mandatory_max_minutes || ''}
            onChange={e => updateTimingRule('mandatory_max_minutes', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Penalite si decalage &gt; cette valeur</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Penalite obligatoire
          </label>
          <input
            type="number"
            value={timingRules.mandatory_penalty || ''}
            onChange={e => updateTimingRule('mandatory_penalty', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Decalage interdit max (min)
          </label>
          <input
            type="number"
            value={timingRules.forbidden_max_minutes || ''}
            onChange={e => updateTimingRule('forbidden_max_minutes', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">Forte penalite si decalage &gt; cette valeur</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Penalite interdite
          </label>
          <input
            type="number"
            value={timingRules.forbidden_penalty || ''}
            onChange={e => updateTimingRule('forbidden_penalty', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </div>
  )
}

function MFPTab({ criteria, updateCriteria }: {
  criteria: BlockCriteria
  updateCriteria: <K extends keyof BlockCriteria>(field: K, value: BlockCriteria[K]) => void
}) {
  const mfpPolicy = criteria.mfp_policy || {}

  const updateMfpPolicy = (field: string, value: number | undefined) => {
    updateCriteria('mfp_policy', { ...mfpPolicy, [field]: value })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Configuration des bonus/penalites M/F/P specifiques a ce bloc
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bonus Mandatory match
          </label>
          <input
            type="number"
            value={mfpPolicy.mandatory_matched_bonus || ''}
            onChange={e => updateMfpPolicy('mandatory_matched_bonus', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Penalite Mandatory miss
          </label>
          <input
            type="number"
            value={mfpPolicy.mandatory_missed_penalty || ''}
            onChange={e => updateMfpPolicy('mandatory_missed_penalty', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Penalite Forbidden detect
          </label>
          <input
            type="number"
            value={mfpPolicy.forbidden_detected_penalty || ''}
            onChange={e => updateMfpPolicy('forbidden_detected_penalty', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bonus Preferred match
          </label>
          <input
            type="number"
            value={mfpPolicy.preferred_matched_bonus || ''}
            onChange={e => updateMfpPolicy('preferred_matched_bonus', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </div>
  )
}
