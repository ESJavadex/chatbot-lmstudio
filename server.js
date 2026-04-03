import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { spawn, exec } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

app.use(express.json())
app.use(express.static(path.join(__dirname, '..')))

let models = []
let currentModel = null
let conversationsDir = path.join(process.env.HOME || '/home/javadex-homelab', '.lmstudio/conversations')

fs.mkdirSync(conversationsDir, { recursive: true })

const API_BASE_URL = 'http://localhost:1234'

app.get('/v1/models', async (req, res) => {
  try {
    // Get model list from LM Studio API
    const response = await fetch(`${API_BASE_URL}/v1/models`)
    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`)
    }
    const data = await response.json()

    // Get loaded models from LM Studio CLI
    exec('/home/javadex-homelab/.lmstudio/bin/lms ps', (error, stdout) => {
      const loadedModels = new Map()
      if (!error && stdout) {
        const lines = stdout.trim().split('\n')
        lines.forEach((line) => {
          if (line.includes('IDENTIFIER')) return // Skip header
          const parts = line.trim().split(/\s{2,}/) // Split on 2+ spaces
          if (parts.length >= 3) {
            const modelId = parts[1]
            const modelStatus = parts[2]
            // Extract context length from parsed columns (prefer largest numeric token)
            let contextSize = null
            const numericCandidates = []
            for (let i = 3; i < parts.length; i++) {
              const val = parseInt(parts[i].replace(/[^\d]/g, ''))
              if (!isNaN(val) && val > 100) {
                numericCandidates.push(val)
              }
            }
            if (numericCandidates.length > 0) {
              contextSize = Math.max(...numericCandidates)
            }
            loadedModels.set(modelId, {
              status: modelStatus,
              context_length: contextSize,
            })
          }
        })
      }

      // Merge loaded status into model list
      const models = data.data || []
      const enrichedModels = models.map((model) => {
        const loadedInfo = loadedModels.get(model.id)
        if (loadedInfo) {
          return {
            ...model,
            loaded_instances: [{
              status: loadedInfo.status,
              config: {
                context_length: loadedInfo.context_length,
              }
            }]
          }
        }
        return {
          ...model,
          loaded_instances: []
        }
      })

      res.json({
        object: data.object,
        data: enrichedModels
      })
    })
  } catch (err) {
    console.error('Error fetching models from LM Studio:', err)
    res.status(500).json({ error: 'Failed to load models from LM Studio' })
  }
})

app.post('/v1/models/load', async (req, res) => {
  try {
    const modelId = req.body.id || req.body.model
    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' })
    }

    // Use LM Studio CLI to load model
    const loadProcess = spawn('/home/javadex-homelab/.lmstudio/bin/lms', ['load', modelId], {
      stdio: 'pipe',
    })

    let output = ''
    let errorOutput = ''

    loadProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    loadProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    loadProcess.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, message: 'Model loaded successfully' })
      } else {
        console.error('Error loading model:', errorOutput || output)
        res.status(500).json({ error: 'Failed to load model', message: errorOutput || output })
      }
    })
  } catch (err) {
    console.error('Error loading model:', err)
    res.status(500).json({ error: 'Failed to load model', message: err.message })
  }
})

app.post('/v1/models/unload', async (req, res) => {
  try {
    const modelId = req.body.id || req.body.model
    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' })
    }

    // Use LM Studio CLI to unload model
    const unloadProcess = spawn('/home/javadex-homelab/.lmstudio/bin/lms', ['unload', modelId], {
      stdio: 'pipe',
    })

    let output = ''
    let errorOutput = ''

    unloadProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    unloadProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    unloadProcess.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, message: 'Model unloaded successfully' })
      } else {
        console.error('Error unloading model:', errorOutput || output)
        res.status(500).json({ error: 'Failed to unload model', message: errorOutput || output })
      }
    })
  } catch (err) {
    console.error('Error unloading model:', err)
    res.status(500).json({ error: 'Failed to unload model', message: err.message })
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

      req.on('close', () => {
        response.body?.cancel?.().catch(() => {})
      })

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

// Start LM Studio API server using CLI (no GUI required)
app.post('/api/start-lm-studio', async (req, res) => {
  try {
    // Check if API server is already running
    try {
      const response = await fetch('http://localhost:1234/v1/models')
      if (response.ok) {
        return res.json({
          success: true,
          message: 'LM Studio API server already running'
        })
      }
    } catch {
      // Not running, proceed to start
    }

    // Start LM Studio API server using CLI
    const lmsPath = '/home/javadex-homelab/.lmstudio/bin/lms'
    const lmsProcess = spawn(lmsPath, ['server', 'start', '--cors'], {
      detached: true,
      stdio: 'ignore'
    })

    lmsProcess.on('error', (err) => {
      console.error('Failed to start LM Studio API server:', err)
      return res.status(500).json({
        error: 'Failed to start LM Studio API server',
        message: err.message
      })
    })

    lmsProcess.unref()

    // Give it a moment to start
    setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:1234/v1/models')
        if (response.ok) {
          return res.json({
            success: true,
            message: 'LM Studio API server started successfully'
          })
        } else {
          return res.status(500).json({
            error: 'Failed to start LM Studio API server',
            message: 'Server started but API not responding'
          })
        }
      } catch (err) {
        return res.status(500).json({
          error: 'Failed to start LM Studio API server',
          message: 'Server started but API not responding'
        })
      }
    }, 3000)
  } catch (err) {
    console.error('Error starting LM Studio API server:', err)
    res.status(500).json({
      error: 'Failed to start LM Studio API server',
      message: err.message
    })
  }
})

// Check if LM Studio API server is running
app.get('/api/lm-studio-status', async (req, res) => {
  try {
    const response = await fetch('http://localhost:1234/v1/models')
    res.json({
      running: true,
      apiAvailable: response.ok
    })
  } catch (err) {
    res.json({
      running: false,
      apiAvailable: false
    })
  }
})

// Error handler to always return JSON
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Chatbot server running on http://localhost:${PORT}`)
  console.log('🌐 Accessible desde tu móvil en:', `http://192.168.1.181:${PORT}`)
})
