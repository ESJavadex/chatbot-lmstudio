import { useMemo, useState } from 'react'

const API_BASE = '/api'

export function Sidebar({
  isOpen,
  showHeader = true,
  conversations,
  currentConversationId,
  onSelectConversation,
  onCreateNew,
  onDeleteConversation,
  models,
  selectedModel,
  onSelectModel,
  onClose,
  onModelLoad,
}) {
  const [query, setQuery] = useState('')
  const [showModels, setShowModels] = useState(true)
  const [loadingModels, setLoadingModels] = useState({})

  const refreshModelsWithRetry = async (retries = 5, delayMs = 1200) => {
    if (!onModelLoad) return
    for (let i = 0; i < retries; i++) {
      await onModelLoad()
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }

  const loadModel = async (modelId, modelName) => {
    setLoadingModels(prev => ({ ...prev, [modelId]: true }))
    try {
      const response = await fetch(`${API_BASE}/v1/models/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modelId })
      })

      if (response.ok) {
        await refreshModelsWithRetry()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Error cargando ${modelName}: ${errorData.error || errorData.message || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error loading model:', error)
      alert(`Error cargando ${modelName}: ${error.message}`)
    } finally {
      setLoadingModels(prev => ({ ...prev, [modelId]: false }))
    }
  }

  const unloadModel = async (modelId, e) => {
    e.stopPropagation()
    setLoadingModels(prev => ({ ...prev, [modelId]: true }))
    try {
      const response = await fetch(`${API_BASE}/v1/models/unload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modelId })
      })

      if (response.ok) {
        await refreshModelsWithRetry()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Error descargando modelo: ${errorData.error || errorData.message || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error unloading model:', error)
      alert(`Error descargando modelo: ${error.message}`)
    } finally {
      setLoadingModels(prev => ({ ...prev, [modelId]: false }))
    }
  }

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q))
  }, [conversations, query])

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {showHeader && (
        <div className="sidebar-header">
          <h3>Workspace</h3>
          <button className="icon-btn close-sidebar-btn" aria-label="Cerrar panel lateral" onClick={onClose}>✕</button>
        </div>
      )}

      <button onClick={onCreateNew} className="new-chat-btn full">+ Nueva conversación</button>

      <input
        className="search-input"
        placeholder="Buscar conversación..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="conversation-list">
        {filteredConversations.length === 0 && <p className="muted">Sin conversaciones</p>}
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
            onClick={() => onSelectConversation(conv.id)}
          >
            <div className="conv-title">{conv.title || `Conversación ${new Date(conv.createdAt).toLocaleDateString()}`}</div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteConversation(conv.id)
              }}
              className="delete-conv-btn"
              title="Eliminar conversación"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="model-selector-container">
        <button onClick={() => setShowModels((v) => !v)} className="toggle-models-btn">
          {showModels ? '▼' : '▶'} Modelos ({models.length})
        </button>

        {showModels && (
          <div className="model-list">
            {models.map((model) => {
              const modelName = model.display_name || model.name || model.id || 'unknown-model'
              const modelKey = model.id || model.key || model.name
              const isActive = (selectedModel?.id || selectedModel?.key || selectedModel?.name) === modelKey
              const isLoaded = (model.loaded_instances || []).length > 0
              const loadedInfo = model.loaded_instances?.[0]
              const isLoading = loadingModels[modelKey]

              return (
                <div
                  key={modelKey}
                  className={`model-item ${isActive ? 'active' : ''} ${isLoaded ? 'loaded' : 'not-loaded'}`}
                  onClick={() => onSelectModel(model)}
                >
                  <div className="model-info">
                    <span className={`model-status ${isLoaded ? 'loaded' : 'not-loaded'}`}>
                      {isLoaded ? '●' : '○'}
                    </span>
                    <span className="model-name">{modelName}</span>
                  </div>
                  {isLoaded && loadedInfo && (
                    <div className="model-details">
                      <small>Context: {loadedInfo.config?.context_length || 'N/A'} tokens</small>
                      {loadedInfo.config?.flash_attention !== undefined && (
                        <small>Flash: {loadedInfo.config.flash_attention ? '✓' : '✗'}</small>
                      )}
                    </div>
                  )}
                  <div className="model-actions">
                    {!isLoaded && (
                      <button
                        className="model-action-btn load-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          loadModel(modelKey, modelName)
                        }}
                        disabled={isLoading}
                        title={`Cargar ${modelName}`}
                      >
                        {isLoading ? '⏳' : '➕'}
                      </button>
                    )}
                    {isLoaded && (
                      <button
                        className="model-action-btn unload-btn"
                        onClick={(e) => unloadModel(modelKey, e)}
                        disabled={isLoading}
                        title={`Descargar ${modelName}`}
                      >
                        {isLoading ? '⏳' : '➖'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
