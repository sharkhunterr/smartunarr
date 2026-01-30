import clsx from 'clsx'
import type { Strategies } from '@/types'

interface TabStrategiesProps {
  strategies?: Strategies
  onChange: (strategies: Strategies | undefined) => void
}

export function TabStrategies({ strategies, onChange }: TabStrategiesProps) {
  const current = strategies || {}

  const update = (field: keyof Strategies, value: unknown) => {
    onChange({ ...current, [field]: value })
  }

  const updateFiller = (field: string, value: unknown) => {
    update('filler_insertion', { ...current.filler_insertion, [field]: value })
  }

  const updateBonuses = (field: string, value: boolean) => {
    update('bonuses', { ...current.bonuses, [field]: value })
  }

  return (
    <div className="space-y-8">
      {/* Main Strategies */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Strategies de programmation
        </h3>

        <div className="space-y-4">
          <ToggleOption
            label="Maintenir les sequences"
            description="Tente de garder les episodes d'une serie ensemble"
            checked={current.maintain_sequence || false}
            onChange={v => update('maintain_sequence', v)}
          />

          <ToggleOption
            label="Maximiser la variete"
            description="Evite de programmer des contenus similaires consecutivement"
            checked={current.maximize_variety || false}
            onChange={v => update('maximize_variety', v)}
          />

          <ToggleOption
            label="Mode marathon"
            description="Favorise les marathons de series/sagas"
            checked={current.marathon_mode || false}
            onChange={v => update('marathon_mode', v)}
          />
        </div>
      </section>

      {/* Repeat Avoidance */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Evitement des repetitions
        </h3>

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Eviter les repetitions pendant:
          </label>
          <input
            type="number"
            min="0"
            max="90"
            value={current.avoid_repeats_days || ''}
            onChange={e => update('avoid_repeats_days', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="14"
            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-sm text-gray-500">jours</span>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Un contenu ne sera pas reprogramme avant ce nombre de jours
        </p>
      </section>

      {/* Filler Insertion */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Insertion de contenu de remplissage
        </h3>

        <ToggleOption
          label="Activer le remplissage"
          description="Insere des bandes-annonces ou courts metrages pour combler les trous"
          checked={current.filler_insertion?.enabled || false}
          onChange={v => updateFiller('enabled', v)}
        />

        {current.filler_insertion?.enabled && (
          <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Types de remplissage
              </label>
              <div className="flex flex-wrap gap-2">
                {['trailer', 'short', 'interlude', 'promo'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const types = current.filler_insertion?.types || []
                      const newTypes = types.includes(type)
                        ? types.filter(t => t !== type)
                        : [...types, type]
                      updateFiller('types', newTypes)
                    }}
                    className={clsx(
                      'px-3 py-1 text-sm rounded-full border transition-colors',
                      current.filler_insertion?.types?.includes(type)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Duree max du filler:
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={current.filler_insertion?.max_duration_min || ''}
                onChange={e => updateFiller('max_duration_min', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="5"
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
          </div>
        )}
      </section>

      {/* Bonuses */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Bonus automatiques
        </h3>

        <div className="space-y-4">
          <ToggleOption
            label="Bonus fetes"
            description="Favorise les contenus lies aux fetes en cours (Noel, Halloween...)"
            checked={current.bonuses?.holiday_bonus || false}
            onChange={v => updateBonuses('holiday_bonus', v)}
          />

          <ToggleOption
            label="Bonus sorties recentes"
            description="Favorise les contenus recemment sortis"
            checked={current.bonuses?.recent_release_bonus || false}
            onChange={v => updateBonuses('recent_release_bonus', v)}
          />

          <ToggleOption
            label="Bonus contenus populaires"
            description="Favorise les contenus avec beaucoup de votes"
            checked={current.bonuses?.popular_content_bonus || false}
            onChange={v => updateBonuses('popular_content_bonus', v)}
          />
        </div>
      </section>
    </div>
  )
}

interface ToggleOptionProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5',
          checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
            checked ? 'left-5' : 'left-0.5'
          )}
        />
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </div>
        <div className="text-sm text-gray-500">
          {description}
        </div>
      </div>
    </div>
  )
}
