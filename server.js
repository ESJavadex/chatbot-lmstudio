import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, '..')))

let models = []
let currentModel = null
let conversationsDir = path.join(process.env.HOME || '/home/javadex-homelab', '.lmstudio/conversations')

fs.mkdirSync(conversationsDir, { recursive: true })

const API_BASE_URL = 'http://localhost:1234'

app.get('/v1/models', async (req, res) => {
  try {
    // Proxy to LM Studio API to get real-time model list with loading status
    const response = await fetch(`${API_BASE_URL}/api/v1/models`)
    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`)
    }
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Error fetching models from LM Studio:', err)
    res.status(500).json({ error: 'Failed to load models from LM Studio' })
  }
})

app.post('/v1/models/load', async (req, res) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/models/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`)
    }
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Error loading model:', err)
    res.status(500).json({ error: 'Failed to load model' })
  }
})

app.post('/v1/models/unload', async (req, res) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/models/unload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`)
    }
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Error unloading model:', err)
    res.status(500).json({ error: 'Failed to unload model' })
  }
})

// Proxy chat completions to LM Studio (OpenAI-compatible endpoint)
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`)
    }

    // Check if response is streaming
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream') || req.body.stream) {
      // Stream the response
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
      res.end()
    } else {
      // Non-streaming response
      const data = await response.json()
      res.json(data)
    }
  } catch (error) {
    console.error('Error calling LM Studio API:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/conversations', (req, res) => {
  fs.readdir(conversationsDir, (err, files) => {
    if (err) {
      console.error('Error reading conversations directory:', err)
      return res.status(500).json([])
    }

    const conversations = files
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(conversationsDir, f), 'utf8')))
      .map(conv => ({
        id: conv.id || path.basename(f, '.json'),
        title: conv.title || `Conversación ${new Date(conv.createdAt).toLocaleDateString()}`,
        createdAt: conv.createdAt || new Date().toISOString(),
        messages: conv.messages || []
      }))

    res.json(conversations)
  })
})

app.post('/conversations', (req, res) => {
  const { id, title, messages } = req.body
  
  const conversation = {
    id: id || Date.now().toString(),
    title: title || `Conversación ${new Date().toLocaleDateString()}`,
    createdAt: new Date().toISOString(),
    messages: messages || []
  }

  fs.writeFileSync(
    path.join(conversationsDir, `${conversation.id}.json`),
    JSON.stringify(conversation, null, 2)
  )

  res.json({ id: conversation.id })
})

app.get('/conversations/:id', (req, res) => {
  const { id } = req.params
  const filePath = path.join(conversationsDir, `${id}.json`)
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  const conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  res.json({
    id: conversation.id || id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    messages: conversation.messages || []
  })
})

app.post('/conversations/:id', (req, res) => {
  const { id } = req.params
  const { messages } = req.body
  
  const existingPath = path.join(conversationsDir, `${id}.json`)
  
  let conversation
  if (fs.existsSync(existingPath)) {
    conversation = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
    conversation.messages = messages || []
  } else {
    conversation = {
      id: id,
      title: `Conversación ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      messages: messages || []
    }
  }

  fs.writeFileSync(
    path.join(conversationsDir, `${id}.json`),
    JSON.stringify(conversation, null, 2)
  )

  res.json({ success: true })
})

app.delete('/conversations/:id', (req, res) => {
  const { id } = req.params
  const filePath = path.join(conversationsDir, `${id}.json`)
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  fs.unlinkSync(filePath)
  res.json({ success: true })
})

app.put('/conversations/:conversationId/messages/:messageId', (req, res) => {
  const { conversationId, messageId } = req.params
  const { content } = req.body
  
  const filePath = path.join(conversationsDir, `${conversationId}.json`)
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  let conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  
  const messageIndex = conversation.messages.findIndex(m => m.id === messageId)
  if (messageIndex !== -1) {
    conversation.messages[messageIndex].content = content
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2))
    res.json({ success: true })
  } else {
    res.status(404).json({ error: 'Message not found' })
  }
})

app.delete('/conversations/:conversationId/messages/:messageId', (req, res) => {
  const { conversationId, messageId } = req.params
  
  const filePath = path.join(conversationsDir, `${conversationId}.json`)
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  let conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  
  conversation.messages = conversation.messages.filter(m => m.id !== messageId)
  fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2))
  
  res.json({ success: true })
})

app.listen(PORT, () => {
  console.log(`Chatbot server running on http://localhost:${PORT}`)
  console.log('🌐 Accessible desde tu móvil en:', `http://192.168.1.181:${PORT}`)
})
