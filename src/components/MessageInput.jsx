import { useRef, useState } from 'react'

export function MessageInput({ onSend, isSending = false, disabled = false }) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef(null)

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = '52px'
  }

  const handleSend = () => {
    if (!message.trim() || disabled || isSending) return
    onSend(message)
    setMessage('')
    resetHeight()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="message-input-container">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`
        }}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Selecciona un modelo para empezar…' : 'Escribe tu mensaje...'}
        className="message-input"
        disabled={disabled || isSending}
      />

      <button onClick={handleSend} disabled={!message.trim() || disabled || isSending} className="send-btn">
        {isSending ? '…' : '➤'}
      </button>
    </div>
  )
}
