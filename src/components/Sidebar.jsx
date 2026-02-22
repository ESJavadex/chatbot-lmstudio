import { useMemo, useState } from 'react'

export function Sidebar({
  isOpen,
  conversations,
  currentConversationId,
  onSelectConversation,
  onCreateNew,
  onDeleteConversation,
  models,
  selectedModel,
  onSelectModel,
  onClose,
}) {
  const [query, setQuery] = useState('')
  const [showModels, setShowModels] = useState(true)

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q))
  }, [conversations, query])

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>Workspace</h3>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>

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

              return (
                <div
                  key={modelKey}
                  className={`model-item ${isActive ? 'active' : ''} ${isLoaded ? 'loaded' : 'not-loaded'}`}
                  onClick={() => onSelectModel(model)}
                >
                  <div className="model-info">
                    <span className="model-status">
                      {isLoaded ? '🟢' : '⚪'}
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
