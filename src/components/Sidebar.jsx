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
              const modelName = model.name || model.id || model.display_name || 'unknown-model'
              const isActive = (selectedModel?.id || selectedModel?.name) === (model.id || model.name)
              return (
                <div
                  key={model.id || model.name}
                  className={`model-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectModel(model)}
                >
                  {modelName}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
