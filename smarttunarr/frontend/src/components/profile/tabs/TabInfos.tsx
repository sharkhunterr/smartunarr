import { useState } from 'react'
import { X, Plus, FileText } from 'lucide-react'
import type { Profile } from '@/types'

interface TabInfosProps {
  formData: Profile
  updateField: <K extends keyof Profile>(field: K, value: Profile[K]) => void
  applyTemplate: (templateKey: string) => void
  templates: string[]
  mode: 'create' | 'edit' | 'duplicate'
}

const TEMPLATE_LABELS: Record<string, string> = {
  empty: 'Vide',
  kids: 'Enfants',
  blockbuster: 'Blockbuster',
  cinema: 'Cinema classique'
}

export function TabInfos({ formData, updateField, applyTemplate, templates, mode }: TabInfosProps) {
  const [newLabel, setNewLabel] = useState('')

  const addLabel = () => {
    const label = newLabel.trim().toLowerCase()
    if (label && !formData.labels.includes(label)) {
      updateField('labels', [...formData.labels, label])
      setNewLabel('')
    }
  }

  const removeLabel = (label: string) => {
    updateField('labels', formData.labels.filter(l => l !== label))
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addLabel()
    }
  }

  return (
    <div className="space-y-6">
      {/* Templates (only in create mode) */}
      {mode === 'create' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Demarrer depuis un template
          </h3>
          <div className="flex flex-wrap gap-2">
            {templates.map(key => (
              <button
                key={key}
                onClick={() => applyTemplate(key)}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                {TEMPLATE_LABELS[key] || key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nom du profil *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="Ex: Mon profil personnalise"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Version
          </label>
          <input
            type="text"
            value={formData.version}
            onChange={e => updateField('version', e.target.value)}
            placeholder="6.1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={e => updateField('description', e.target.value)}
          placeholder="Description du profil..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Labels */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Labels
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.labels.map(label => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm"
            >
              {label}
              <button
                onClick={() => removeLabel(label)}
                className="p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={handleLabelKeyDown}
            placeholder="Ajouter un label..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={addLabel}
            disabled={!newLabel.trim()}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Generation Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Iterations par defaut: {formData.default_iterations}
          </label>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={formData.default_iterations}
            onChange={e => updateField('default_iterations', Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Randomness: {(formData.default_randomness * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={formData.default_randomness}
            onChange={e => updateField('default_randomness', Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Metadata (read-only for edit mode) */}
      {mode === 'edit' && formData.created_at && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium">Cree le:</span>{' '}
              {new Date(formData.created_at).toLocaleString('fr-FR')}
            </div>
            {formData.updated_at && (
              <div>
                <span className="font-medium">Modifie le:</span>{' '}
                {new Date(formData.updated_at).toLocaleString('fr-FR')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
