import axios from 'axios'
import type {
  Profile,
  ServiceConfig,
  ConnectionTestResponse,
  TunarrChannel,
  ProgrammingRequest,
  AIProgrammingRequest,
  ProgramResult,
  ScoringRequest,
  ScoringResult,
  HistoryEntry,
  OllamaModel,
  PlexLibrary,
  JobResponse,
  AIGenerateProfileRequest,
  AIGenerateProfileResponse,
  AIModelsResponse
} from '@/types'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Profiles API
export const profilesApi = {
  list: async (label?: string): Promise<Profile[]> => {
    const params = label ? { label } : {}
    const response = await client.get('/profiles', { params })
    return response.data
  },

  get: async (id: string): Promise<Profile> => {
    const response = await client.get(`/profiles/${id}`)
    return response.data
  },

  create: async (data: Partial<Profile>): Promise<Profile> => {
    const response = await client.post('/profiles', data)
    return response.data
  },

  update: async (id: string, data: Partial<Profile>): Promise<Profile> => {
    const response = await client.put(`/profiles/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/profiles/${id}`)
  },

  duplicate: async (id: string, newName: string): Promise<Profile> => {
    const response = await client.post(`/profiles/${id}/duplicate`, null, {
      params: { new_name: newName }
    })
    return response.data
  },

  import: async (profileData: Record<string, unknown>, overwrite = false): Promise<Profile> => {
    const response = await client.post('/profiles/import', profileData, {
      params: { overwrite }
    })
    return response.data
  },

  export: async (id: string): Promise<Record<string, unknown>> => {
    const response = await client.get(`/profiles/${id}/export`)
    return response.data
  },

  validate: async (profileData: Record<string, unknown>): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> => {
    const response = await client.post('/profiles/validate', profileData)
    return response.data
  },

  getStats: async (id: string) => {
    const response = await client.get(`/profiles/${id}/stats`)
    return response.data
  }
}

// Services API
export const servicesApi = {
  list: async (): Promise<ServiceConfig[]> => {
    const response = await client.get('/services')
    return response.data
  },

  get: async (type: string): Promise<ServiceConfig> => {
    const response = await client.get(`/services/${type}`)
    return response.data
  },

  update: async (type: string, data: Record<string, string>): Promise<ServiceConfig> => {
    const response = await client.put(`/services/${type}`, data)
    return response.data
  },

  delete: async (type: string): Promise<void> => {
    await client.delete(`/services/${type}`)
  },

  test: async (type: string): Promise<ConnectionTestResponse> => {
    const response = await client.post(`/services/${type}/test`)
    return response.data
  }
}

// Cache API
export interface LibraryCacheStats {
  library_id: string
  total_items: number
  enriched_items: number
  movies: number
  episodes: number
  other: number
  oldest_cache: string | null
  newest_cache: string | null
  oldest_enrichment: string | null
  newest_enrichment: string | null
}

export interface CacheStats {
  total_content: number
  total_enriched: number
  libraries: LibraryCacheStats[]
}

export const cacheApi = {
  getStats: async (): Promise<CacheStats> => {
    const response = await client.get('/services/cache/stats')
    return response.data
  },

  clearAll: async (): Promise<{ success: boolean; deleted_content: number; deleted_metadata: number }> => {
    const response = await client.delete('/services/cache/content')
    return response.data
  },

  clearLibrary: async (libraryId: string): Promise<{ success: boolean; deleted_content: number; deleted_metadata: number }> => {
    const response = await client.delete(`/services/cache/library/${libraryId}`)
    return response.data
  },

  forceEnrich: async (libraryId?: string): Promise<{ success: boolean; enriched: number; failed: number; total: number }> => {
    const params = libraryId ? { library_id: libraryId } : {}
    const response = await client.post('/services/cache/enrich', null, { params })
    return response.data
  },

  refreshFromPlex: async (libraryId?: string): Promise<{ success: boolean; added: number; updated: number; total: number }> => {
    const params = libraryId ? { library_id: libraryId } : {}
    const response = await client.post('/services/cache/refresh', null, { params })
    return response.data
  }
}

// Tunarr API
export const tunarrApi = {
  getChannels: async (): Promise<TunarrChannel[]> => {
    const response = await client.get('/services/tunarr/channels')
    return response.data
  },

  getChannelPrograms: async (channelId: string): Promise<TunarrChannel> => {
    const response = await client.get(`/services/tunarr/channels/${channelId}/programs`)
    return response.data
  }
}

// Plex API
export const plexApi = {
  getLibraries: async (): Promise<PlexLibrary[]> => {
    const response = await client.get('/services/plex/libraries')
    return response.data
  },

  getLibraryContent: async (libraryId: string, contentType?: string, limit = 100) => {
    const params: Record<string, unknown> = { limit }
    if (contentType) params.content_type = contentType
    const response = await client.get(`/services/plex/libraries/${libraryId}/content`, { params })
    return response.data
  }
}

// Ollama API
export const ollamaApi = {
  getModels: async (): Promise<OllamaModel[]> => {
    const response = await client.get('/services/ollama/models')
    return response.data
  }
}

// AI Profile Generation API
export const aiApi = {
  generateProfile: async (request: AIGenerateProfileRequest): Promise<AIGenerateProfileResponse> => {
    const response = await client.post('/ai/generate-profile', request)
    return response.data
  },

  getModels: async (): Promise<AIModelsResponse> => {
    const response = await client.get('/ai/models')
    return response.data
  },

  checkModel: async (model: string): Promise<{ model: string; available: boolean; message: string }> => {
    const response = await client.post('/ai/check-model', null, { params: { model } })
    return response.data
  }
}

// Programming API
export const programmingApi = {
  generate: async (request: ProgrammingRequest): Promise<JobResponse> => {
    const response = await client.post('/programming/generate', request)
    return response.data
  },

  generateWithAI: async (request: AIProgrammingRequest): Promise<JobResponse> => {
    const response = await client.post('/programming/generate-ai', request)
    return response.data
  },

  apply: async (resultId: string): Promise<void> => {
    await client.post(`/programming/apply/${resultId}`)
  },

  getResult: async (resultId: string): Promise<ProgramResult> => {
    const response = await client.get(`/programming/results/${resultId}`)
    return response.data
  }
}

// Scoring API
export const scoringApi = {
  analyze: async (request: ScoringRequest): Promise<JobResponse> => {
    const response = await client.post('/scoring/analyze', request)
    return response.data
  },

  getResult: async (resultId: string): Promise<ScoringResult> => {
    const response = await client.get(`/scoring/results/${resultId}`)
    return response.data
  },

  exportCSV: async (resultId: string): Promise<Blob> => {
    const response = await client.get(`/scoring/results/${resultId}/export/csv`, {
      responseType: 'blob'
    })
    return response.data
  },

  exportJSON: async (resultId: string): Promise<Record<string, unknown>> => {
    const response = await client.get(`/scoring/results/${resultId}/export/json`)
    return response.data
  }
}

// History API
export const historyApi = {
  list: async (params?: {
    type?: 'programming' | 'scoring' | 'ai_generation'
    limit?: number
    offset?: number
  }): Promise<HistoryEntry[]> => {
    const response = await client.get('/history', { params })
    return response.data
  },

  get: async (id: string): Promise<HistoryEntry> => {
    const response = await client.get(`/history/${id}`)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/history/${id}`)
  },

  clear: async (type?: string): Promise<void> => {
    const params = type ? { type } : {}
    await client.delete('/history', { params })
  },

  /**
   * Get result for a history entry (works for both programming and scoring)
   */
  getResult: async (entry: HistoryEntry): Promise<ProgramResult | ScoringResult | null> => {
    if (!entry.result_id) return null
    if (entry.type === 'programming' || entry.type === 'ai_generation') {
      return programmingApi.getResult(entry.result_id)
    }
    return scoringApi.getResult(entry.result_id)
  }
}

// Health API
export const healthApi = {
  check: async (): Promise<{ status: string }> => {
    const response = await client.get('/health')
    return response.data
  }
}

// Jobs API
export const jobsApi = {
  list: async (limit = 20): Promise<unknown[]> => {
    const response = await client.get('/jobs', { params: { limit } })
    return response.data
  },

  getActive: async (): Promise<unknown[]> => {
    const response = await client.get('/jobs/active')
    return response.data
  },

  get: async (jobId: string): Promise<unknown> => {
    const response = await client.get(`/jobs/${jobId}`)
    return response.data
  },

  cancel: async (jobId: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.post(`/jobs/${jobId}/cancel`)
    return response.data
  },

  clearCompleted: async (): Promise<{ removed: number }> => {
    const response = await client.delete('/jobs/completed')
    return response.data
  }
}

// Logs API
export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  source?: string
}

export interface LogsResponse {
  logs: LogEntry[]
  total: number
  limit: number
  offset: number
}

export const logsApi = {
  list: async (params?: { level?: string; limit?: number; offset?: number; search?: string }): Promise<LogsResponse> => {
    const response = await client.get('/logs', { params })
    return response.data
  },

  clear: async (): Promise<void> => {
    await client.delete('/logs')
  },

  export: async (level?: string): Promise<{ logs: LogEntry[]; exported_at: string }> => {
    const params = level ? { level } : {}
    const response = await client.get('/logs/export', { params })
    return response.data
  },

  cleanup: async (retentionDays: number): Promise<{ deleted: number; remaining: number }> => {
    const response = await client.delete('/logs/cleanup', { params: { retention_days: retentionDays } })
    return response.data
  }
}

export default client
