import type { MandatoryForbiddenCriteria } from '@/types'
import { TagInput } from '../common/TagInput'

interface TabMFPGlobalProps {
  criteria: MandatoryForbiddenCriteria
  onChange: (criteria: MandatoryForbiddenCriteria) => void
}

const COMMON_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
  'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'
]

const AGE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TP', 'Tous publics', '+10', '+12', '+16', '+18', 'TV-MA', 'TV-14', 'TV-PG']

const COMMON_KEYWORDS = [
  'violence', 'gore', 'blood', 'horror', 'scary', 'adult', 'sexual', 'nude',
  'drugs', 'alcohol', 'family', 'children', 'disney', 'pixar', 'dreamworks',
  'friendship', 'adventure', 'magic', 'educational'
]

const COMMON_COLLECTIONS = [
  'Disney Classics', 'Pixar', 'DreamWorks Animation', 'Studio Ghibli', 'Illumination',
  'Marvel Cinematic Universe', 'DC Extended Universe', 'Star Wars', 'Harry Potter'
]

export function TabMFPGlobal({ criteria, onChange }: TabMFPGlobalProps) {
  const mandatory = criteria.mandatory || {}
  const forbidden = criteria.forbidden || {}
  const preferred = criteria.preferred || {}

  const updateMandatory = (field: string, value: unknown) => {
    onChange({
      ...criteria,
      mandatory: { ...mandatory, [field]: value }
    })
  }

  const updateForbidden = (field: string, value: unknown) => {
    onChange({
      ...criteria,
      forbidden: { ...forbidden, [field]: value }
    })
  }

  const updatePreferred = (field: string, value: unknown) => {
    onChange({
      ...criteria,
      preferred: { ...preferred, [field]: value }
    })
  }

  return (
    <div className="space-y-8">
      {/* MANDATORY */}
      <section>
        <h3 className="text-lg font-medium text-orange-700 dark:text-orange-400 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-sm font-bold">M</span>
          Mandatory (Criteres obligatoires)
        </h3>
        <div className="space-y-4 pl-8">
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
                value={mandatory.min_tmdb_rating || ''}
                onChange={e => updateMandatory('min_tmdb_rating', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Votes minimum
              </label>
              <input
                type="number"
                value={mandatory.min_vote_count || ''}
                onChange={e => updateMandatory('min_vote_count', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Genres requis (au moins un)
            </label>
            <TagInput
              values={mandatory.required_genres || []}
              onChange={v => updateMandatory('required_genres', v)}
              suggestions={COMMON_GENRES}
              placeholder="Ajouter un genre..."
              color="gray"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Classifications autorisees
            </label>
            <TagInput
              values={mandatory.allowed_age_ratings || []}
              onChange={v => updateMandatory('allowed_age_ratings', v)}
              suggestions={AGE_RATINGS}
              placeholder="Ajouter..."
              color="gray"
            />
          </div>
        </div>
      </section>

      {/* FORBIDDEN */}
      <section>
        <h3 className="text-lg font-medium text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-sm font-bold">F</span>
          Forbidden (Criteres interdits)
        </h3>
        <div className="space-y-4 pl-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Genres interdits
            </label>
            <TagInput
              values={forbidden.genres || []}
              onChange={v => updateForbidden('genres', v)}
              suggestions={COMMON_GENRES}
              placeholder="Ajouter un genre..."
              color="red"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Classifications interdites
            </label>
            <TagInput
              values={forbidden.age_ratings || []}
              onChange={v => updateForbidden('age_ratings', v)}
              suggestions={AGE_RATINGS}
              placeholder="Ajouter..."
              color="red"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mots-cles interdits
            </label>
            <TagInput
              values={forbidden.keywords || []}
              onChange={v => updateForbidden('keywords', v)}
              suggestions={COMMON_KEYWORDS}
              placeholder="Ajouter..."
              color="red"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collections interdites
            </label>
            <TagInput
              values={forbidden.collections || []}
              onChange={v => updateForbidden('collections', v)}
              suggestions={COMMON_COLLECTIONS}
              placeholder="Ajouter..."
              color="red"
            />
          </div>
        </div>
      </section>

      {/* PREFERRED */}
      <section>
        <h3 className="text-lg font-medium text-green-700 dark:text-green-400 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-bold">P</span>
          Preferred (Criteres preferes)
        </h3>
        <div className="space-y-4 pl-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Genres preferes
            </label>
            <TagInput
              values={preferred.genres || []}
              onChange={v => updatePreferred('genres', v)}
              suggestions={COMMON_GENRES}
              placeholder="Ajouter un genre..."
              color="green"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mots-cles preferes
            </label>
            <TagInput
              values={preferred.keywords || []}
              onChange={v => updatePreferred('keywords', v)}
              suggestions={COMMON_KEYWORDS}
              placeholder="Ajouter..."
              color="green"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collections preferees
            </label>
            <TagInput
              values={preferred.collections || []}
              onChange={v => updatePreferred('collections', v)}
              suggestions={COMMON_COLLECTIONS}
              placeholder="Ajouter..."
              color="green"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Studios preferes
            </label>
            <TagInput
              values={preferred.studios || []}
              onChange={v => updatePreferred('studios', v)}
              suggestions={['Walt Disney Pictures', 'Pixar', 'DreamWorks', 'Warner Bros.', 'Universal', 'Sony Pictures']}
              placeholder="Ajouter..."
              color="green"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
