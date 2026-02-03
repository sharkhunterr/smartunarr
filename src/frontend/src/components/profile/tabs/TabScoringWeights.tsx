import type { ScoringWeights, MFPPolicy, CriterionMultipliers } from '@/types'

interface TabScoringWeightsProps {
  weights: ScoringWeights
  mfpPolicy?: MFPPolicy
  multipliers?: CriterionMultipliers
  onWeightsChange: (weights: ScoringWeights) => void
  onMfpPolicyChange: (policy: MFPPolicy | undefined) => void
  onMultipliersChange: (multipliers: CriterionMultipliers | undefined) => void
}

const WEIGHT_LABELS: Record<keyof ScoringWeights, string> = {
  type: 'Type de contenu',
  duration: 'Duree',
  genre: 'Genres',
  timing: 'Timing',
  strategy: 'Strategie',
  age: 'Classification age',
  rating: 'Notes',
  filter: 'Filtres',
  bonus: 'Bonus'
}

const MULTIPLIER_LABELS: Record<string, string> = {
  type: 'Type',
  duration: 'Duree',
  genre: 'Genre',
  timing: 'Timing',
  strategy: 'Strategie',
  age: 'Age',
  rating: 'Rating',
  filter: 'Filter',
  bonus: 'Bonus'
}

export function TabScoringWeights({
  weights,
  mfpPolicy,
  multipliers,
  onWeightsChange,
  onMfpPolicyChange,
  onMultipliersChange
}: TabScoringWeightsProps) {

  const updateWeight = (key: keyof ScoringWeights, value: number) => {
    onWeightsChange({ ...weights, [key]: value })
  }

  const currentMfp = mfpPolicy || {}
  const updateMfp = (field: string, value: number | undefined) => {
    const newPolicy = { ...currentMfp, [field]: value }
    // Check if all values are undefined/null
    const hasValues = Object.values(newPolicy).some(v => v !== undefined && v !== null)
    onMfpPolicyChange(hasValues ? newPolicy : undefined)
  }

  const currentMultipliers = multipliers || {}
  const updateMultiplier = (field: string, value: number | undefined) => {
    const newMult = { ...currentMultipliers, [field]: value }
    const hasValues = Object.values(newMult).some(v => v !== undefined && v !== null && v !== 1)
    onMultipliersChange(hasValues ? newMult : undefined)
  }

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w || 0), 0)

  return (
    <div className="space-y-8">
      {/* Scoring Weights */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Poids des criteres
          </h3>
          <span className="text-sm text-gray-500">
            Total: {totalWeight}
          </span>
        </div>

        <div className="space-y-4">
          {(Object.keys(WEIGHT_LABELS) as Array<keyof ScoringWeights>).map(key => (
            <div key={key} className="flex items-center gap-4">
              <label className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300">
                {WEIGHT_LABELS[key]}
              </label>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={weights[key] || 0}
                onChange={e => updateWeight(key, Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={weights[key] || 0}
                onChange={e => updateWeight(key, Number(e.target.value))}
                className="w-16 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          Les poids determinent l'importance relative de chaque critere dans le calcul du score final.
          Un poids plus eleve donne plus d'impact au critere.
        </div>
      </section>

      {/* MFP Policy */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Politique M/F/P globale
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
              Bonus Mandatory match
            </label>
            <input
              type="number"
              value={currentMfp.mandatory_matched_bonus || ''}
              onChange={e => updateMfp('mandatory_matched_bonus', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="10"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
              Penalite Mandatory miss
            </label>
            <input
              type="number"
              value={currentMfp.mandatory_missed_penalty || ''}
              onChange={e => updateMfp('mandatory_missed_penalty', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="-30"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-700 dark:text-red-400 mb-1">
              Penalite Forbidden detect
            </label>
            <input
              type="number"
              value={currentMfp.forbidden_detected_penalty || ''}
              onChange={e => updateMfp('forbidden_detected_penalty', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="-150"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-green-700 dark:text-green-400 mb-1">
              Bonus Preferred match
            </label>
            <input
              type="number"
              value={currentMfp.preferred_matched_bonus || ''}
              onChange={e => updateMfp('preferred_matched_bonus', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="15"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </section>

      {/* Criterion Multipliers */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Multiplicateurs de criteres
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Multiplient le score d'un critere. Valeur par defaut: 1.0
        </p>

        <div className="grid grid-cols-3 gap-3">
          {Object.keys(MULTIPLIER_LABELS).map(key => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300 w-16">
                {MULTIPLIER_LABELS[key]}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={currentMultipliers[key as keyof CriterionMultipliers] || ''}
                onChange={e => updateMultiplier(key, e.target.value ? Number(e.target.value) : undefined)}
                placeholder="1.0"
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
