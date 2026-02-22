import { useEffect, useMemo, useState } from 'react'
import { Chat, MessageInput, Sidebar } from './components'

const API_BASE = ''
const STORAGE_KEY = 'chatbot_lmstudio_conversations_v1'

function App() {
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    loadAvailableModels()
    loadConversationsFromStorage()
  }, [])

  const selectedModelName = useMemo(
    () => selectedModel?.name || selectedModel?.id || selectedModel?.display_name || null,
    [selectedModel],
  )

  const persistConversations = (next) => {
    setConversations(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const loadConversationsFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      const arr = Array.isArray(parsed) ? parsed : []
      persistConversations(arr)
    } catch {
      persistConversations([])
    }
  }

  const loadAvailableModels = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/models`)
      const data = await response.json()
      const modelList = Array.isArray(data) ? data : (data.models || data.data || [])
      setModels(modelList)

      if (modelList.length > 0 && !selectedModel) {
        const preferredOrder = [
          'qwen3-coder-next',
          'qwen3-14b-claude-sonnet-4.5-reasoning-distill',
          'openai-gpt-oss-20b-abliterated-uncensored-neo-imatrix',
        ]

        const preferred = preferredOrder
          .map((id) => modelList.find((m) => (m.id || m.name) === id))
          .find(Boolean)

        // Prefer loaded models
        const loadedModel = modelList.find((m) => (m.loaded_instances || []).length > 0)
        setSelectedModel(loadedModel || preferred || modelList[0])
      }
    } catch (error) {
      console.error('Error loading models:', error)
    }
  }

  const createNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
  }

  const loadConversation = (conversationId) => {
    const conv = conversations.find((c) => c.id === conversationId)
    if (!conv) return
    setCurrentConversationId(conversationId)
    setMessages(conv.messages || [])
    if (window.innerWidth < 1024) setIsSidebarOpen(false)
  }

  const saveConversation = (conversationId, nextMessages) => {
    const now = new Date().toISOString()
    const existing = conversations.find((c) => c.id === conversationId)
    const generatedTitle = `Chat ${new Date(existing?.createdAt || now).toLocaleString()}`

    const nextConversation = {
      id: conversationId,
      title: existing?.title || generatedTitle,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      messages: nextMessages,
    }

    const next = [
      nextConversation,
      ...conversations.filter((c) => c.id !== conversationId),
    ]

    persistConversations(next)
  }

  const deleteConversation = (conversationId) => {
    const next = conversations.filter((c) => c.id !== conversationId)
    persistConversations(next)
    if (currentConversationId === conversationId) createNewConversation()
  }

  const updateMessage = (conversationId, messageId, content) => {
    if (!conversationId) return
    const nextMessages = messages.map((m) => (m.id === messageId ? { ...m, content } : m))
    setMessages(nextMessages)
    saveConversation(conversationId, nextMessages)
  }

  const deleteMessage = (conversationId, messageId) => {
    const nextMessages = messages.filter((m) => m.id !== messageId)
    setMessages(nextMessages)
    if (conversationId) saveConversation(conversationId, nextMessages)
  }

  const handleSendMessage = async (content) => {
    if (!selectedModelName || !content.trim() || isSending) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setIsSending(true)

    let convoId = currentConversationId
    if (!convoId) {
      convoId = `${Date.now()}`
      setCurrentConversationId(convoId)
    }

    try {
      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel.id || selectedModel.key || selectedModel.name,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      })

      if (!response.ok) throw new Error('Failed to get response from LM Studio')

      const assistantId = (Date.now() + 1).toString()
      let assistantText = ''

      const seedAssistant = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      }

      setMessages([...nextMessages, seedAssistant])

      const contentType = response.headers.get('content-type') || ''
      const canStream = response.body && (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson') || contentType.includes('text/plain'))

      if (canStream) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const raw of lines) {
            const line = raw.trim()
            if (!line) continue

            const payload = line.startsWith('data:') ? line.slice(5).trim() : line
            if (payload === '[DONE]') continue

            try {
              const parsed = JSON.parse(payload)
              const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.text ?? ''
              if (delta) {
                assistantText += delta
                const updated = [...nextMessages, { ...seedAssistant, content: assistantText }]
                setMessages(updated)
              }
            } catch {
              // Ignore non-JSON chunks
            }
          }
        }
      } else {
        const data = await response.json()
        assistantText = data?.choices?.[0]?.message?.content || data.content || data.message || ''
      }

      if (!assistantText) {
        assistantText = 'No response'
      }

      const finalMessages = [...nextMessages, { ...seedAssistant, content: assistantText }]
      setMessages(finalMessages)
      saveConversation(convoId, finalMessages)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `⚠️ ${error.message}`,
        timestamp: new Date().toISOString(),
      }
      const finalMessages = [...nextMessages, errorMessage]
      setMessages(finalMessages)
      saveConversation(convoId, finalMessages)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={loadConversation}
        onCreateNew={() => {
          createNewConversation()
          if (window.innerWidth < 1024) setIsSidebarOpen(false)
        }}
        onDeleteConversation={deleteConversation}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={(model) => {
          setSelectedModel(model)
          if (window.innerWidth < 1024) setIsSidebarOpen(false)
        }}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      <main className="chat-layout">
        <header className="chat-header">
          <button className="icon-btn" onClick={() => setIsSidebarOpen((v) => !v)} title="Menu">☰</button>
          <div className="header-main">
            <h1>Chat LM Studio</h1>
            <p>{selectedModelName ? `Modelo: ${selectedModelName}` : 'Selecciona un modelo'}</p>
          </div>
          <button className="new-chat-btn" onClick={createNewConversation}>Nueva</button>
        </header>

        <section className="chat-body">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>Empieza a chatear</h2>
              <p>{selectedModelName ? 'Escribe abajo para empezar una conversación.' : 'Selecciona un modelo en el panel lateral.'}</p>
            </div>
          ) : (
            <Chat
              messages={messages}
              onEditMessage={(messageId, text) => updateMessage(currentConversationId, messageId, text)}
              onDeleteMessage={(messageId) => deleteMessage(currentConversationId, messageId)}
            />
          )}
        </section>

        <MessageInput onSend={handleSendMessage} isSending={isSending} disabled={!selectedModelName} />
      </main>
    </div>
  )
}

export default App
