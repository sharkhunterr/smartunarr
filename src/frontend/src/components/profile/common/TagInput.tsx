import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import clsx from 'clsx'

interface TagInputProps {
  values: string[]
  onChange: (values: string[]) => void
  suggestions?: string[]
  placeholder?: string
  color?: 'green' | 'red' | 'blue' | 'gray'
}

const colorClasses = {
  green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
}

export function TagInput({
  values,
  onChange,
  suggestions = [],
  placeholder = 'Ajouter...',
  color = 'gray'
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter suggestions
  const filteredSuggestions = suggestions.filter(
    s => !values.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  )

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addValue = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeValue = (value: string) => {
    onChange(values.filter(v => v !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.trim()) {
        addValue(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      removeValue(values[values.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 min-h-[42px]">
        {values.map(value => (
          <span
            key={value}
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm',
              colorClasses[color]
            )}
          >
            {value}
            <button
              type="button"
              onClick={() => removeValue(value)}
              className="p-0.5 hover:opacity-70 rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-gray-900 dark:text-white focus:outline-none text-sm"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map(suggestion => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addValue(suggestion)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-3 h-3 inline mr-2 opacity-50" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
