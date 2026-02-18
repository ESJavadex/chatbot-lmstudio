import { useEffect, useRef, useState } from 'react'

export function Chat({ messages, onEditMessage, onDeleteMessage }) {
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleEdit = (message) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
  }

  const saveEdit = () => {
    if (editingMessageId && editContent.trim()) {
      onEditMessage(editingMessageId, editContent.trim())
      setEditingMessageId(null)
      setEditContent('')
    }
  }

  return (
    <div className="chat-messages">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        return (
          <article
            key={message.id}
            className={`message-row ${isUser ? 'user' : 'assistant'} ${editingMessageId === message.id ? 'edit-mode' : ''}`}
          >
            <div className="avatar" aria-hidden>
              {isUser ? 'U' : 'AI'}
            </div>

            <div className={`message-main ${isUser ? 'user' : 'assistant'}`}>
              <div className={`message ${isUser ? 'user' : 'assistant'}`}>
                <div className="message-top">
                  <span className="role">{isUser ? 'You' : 'Assistant'}</span>
                </div>

                {editingMessageId === message.id ? (
                  <div className="edit-container">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="edit-input" />
                    <div className="edit-actions">
                      <button onClick={() => { setEditingMessageId(null); setEditContent('') }}>Cancelar</button>
                      <button onClick={saveEdit}>Guardar</button>
                    </div>
                  </div>
                ) : (
                  <p className="message-content">{message.content}</p>
                )}
              </div>

              <div className="message-actions" aria-label="Message actions">
                <button className="icon-action edit-btn" title="Editar mensaje" onClick={() => handleEdit(message)}>✏️</button>
                <button className="icon-action delete-btn" title="Borrar mensaje" onClick={() => onDeleteMessage(message.id)}>🗑️</button>
              </div>
            </div>
          </article>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
