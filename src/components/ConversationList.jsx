export function ConversationList({ conversations, currentConversationId, onSelectConversation }) {
  return (
    <div className="conversation-list">
      {conversations.map(conv => (
        <div
          key={conv.id}
          className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
          onClick={() => onSelectConversation(conv.id)}
        >
          <span className="conv-title">{conv.title || `Conversación ${new Date(conv.createdAt).toLocaleDateString()}`}</span>
        </div>
      ))}
    </div>
  )
}
