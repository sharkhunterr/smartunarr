import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import type { CriterionRules } from '@/types'
import { TagInput } from './TagInput'

interface MFPRuleEditorProps {
  rule?: CriterionRules
  onChange: (rule: CriterionRules) => void
  suggestions?: string[]
  showPenalties?: boolean
}

export function MFPRuleEditor({
  rule,
  onChange,
  suggestions = [],
  showPenalties = true
}: MFPRuleEditorProps) {
  const [expanded, setExpanded] = useState(false)

  const currentRule: CriterionRules = rule || {}

  const updateRule = (field: keyof CriterionRules, value: unknown) => {
    onChange({ ...currentRule, [field]: value })
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header with summary */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3 text-sm">
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium',
            (currentRule.mandatory_values?.length ?? 0) > 0
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
          )}>
            M: {currentRule.mandatory_values?.length || 0}
          </span>
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium',
            (currentRule.forbidden_values?.length ?? 0) > 0
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
          )}>
            F: {currentRule.forbidden_values?.length || 0}
          </span>
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium',
            (currentRule.preferred_values?.length ?? 0) > 0
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
          )}>
            P: {currentRule.preferred_values?.length || 0}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Mandatory */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-orange-700 dark:text-orange-400">
                Mandatory (obligatoire)
              </label>
              {showPenalties && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Penalite:</span>
                  <input
                    type="number"
                    value={currentRule.mandatory_penalty || ''}
                    onChange={e => updateRule('mandatory_penalty', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="-50"
                    className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
            <TagInput
              values={currentRule.mandatory_values || []}
              onChange={v => updateRule('mandatory_values', v.length > 0 ? v : undefined)}
              suggestions={suggestions}
              placeholder="Valeurs obligatoires..."
              color="gray"
            />
            <p className="text-xs text-gray-500 mt-1">
              Au moins une de ces valeurs doit etre presente
            </p>
          </div>

          {/* Forbidden */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-red-700 dark:text-red-400">
                Forbidden (interdit)
              </label>
              {showPenalties && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Penalite:</span>
                  <input
                    type="number"
                    value={currentRule.forbidden_penalty || ''}
                    onChange={e => updateRule('forbidden_penalty', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="-150"
                    className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
            <TagInput
              values={currentRule.forbidden_values || []}
              onChange={v => updateRule('forbidden_values', v.length > 0 ? v : undefined)}
              suggestions={suggestions}
              placeholder="Valeurs interdites..."
              color="red"
            />
            <p className="text-xs text-gray-500 mt-1">
              Aucune de ces valeurs ne doit etre presente
            </p>
          </div>

          {/* Preferred */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-green-700 dark:text-green-400">
                Preferred (prefere)
              </label>
              {showPenalties && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Bonus:</span>
                  <input
                    type="number"
                    value={currentRule.preferred_bonus || ''}
                    onChange={e => updateRule('preferred_bonus', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="+15"
                    className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
            <TagInput
              values={currentRule.preferred_values || []}
              onChange={v => updateRule('preferred_values', v.length > 0 ? v : undefined)}
              suggestions={suggestions}
              placeholder="Valeurs preferees..."
              color="green"
            />
            <p className="text-xs text-gray-500 mt-1">
              Bonus si une de ces valeurs est presente
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
