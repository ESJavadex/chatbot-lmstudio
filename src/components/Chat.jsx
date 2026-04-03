import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import mermaid from 'mermaid'

function encodeBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

marked.setOptions({ gfm: true, breaks: true })

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  suppressErrorRendering: false,
  flowchart: {
    htmlLabels: true,
    useMaxWidth: true,
    defaultRenderer: 'dagre-d3',
  },
  themeVariables: {
    background: '#0f172a',
    primaryColor: '#1f2937',
    primaryBorderColor: '#94a3b8',
    primaryTextColor: '#f8fafc',
    secondaryColor: '#334155',
    secondaryBorderColor: '#94a3b8',
    secondaryTextColor: '#f8fafc',
    tertiaryColor: '#475569',
    tertiaryBorderColor: '#cbd5e1',
    tertiaryTextColor: '#f8fafc',
    mainBkg: '#1f2937',
    textColor: '#f8fafc',
    lineColor: '#cbd5e1',
    nodeBorder: '#94a3b8',
    clusterBkg: '#111827',
    clusterBorder: '#64748b',
    edgeLabelBackground: '#0f172a',
  },
})

const BLOCK_REGEX = /```(mermaid|html)\s*\n([\s\S]*?)```/gi
const HTML_SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['style'],
  ADD_ATTR: [
    'style',
    'class',
    'target',
    'rel',
    'srcdoc',
    'allow',
    'allowfullscreen',
  ],
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function extractBlocks(text = '') {
  const blocks = []
  let lastIndex = 0
  let match

  while ((match = BLOCK_REGEX.exec(text)) !== null) {
    const [fullMatch, language, code] = match
    const start = match.index

    if (start > lastIndex) {
      blocks.push({
        type: 'markdown',
        content: text.slice(lastIndex, start),
      })
    }

    blocks.push({
      type: language.toLowerCase(),
      content: code.trim(),
      raw: fullMatch,
    })

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < text.length) {
    blocks.push({
      type: 'markdown',
      content: text.slice(lastIndex),
    })
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'markdown', content: text })
  }

  return blocks.filter((block) => block.content?.trim() || block.type !== 'markdown')
}

function renderMarkdown(text = '') {
  const raw = marked.parse(text)
  return DOMPurify.sanitize(raw)
}

function buildPreviewDocument(html = '') {
  const sanitizedBody = DOMPurify.sanitize(html, HTML_SANITIZE_CONFIG)
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background: #0f172a;
        color: #e2e8f0;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      body {
        padding: 16px;
      }
      img, svg, canvas, iframe, video {
        max-width: 100%;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    ${sanitizedBody}
  </body>
</html>`
}

function CodePanel({ code, language }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="render-code-panel">
      <button className="render-toggle-btn" onClick={() => setIsOpen((value) => !value)}>
        {isOpen ? 'Ocultar código' : `Ver código ${language.toUpperCase()}`}
      </button>
      {isOpen && (
        <pre className="render-source-block">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

function MermaidBlock({ code, onExpand }) {
  const id = useMemo(() => `mermaid-${Math.random().toString(36).slice(2, 10)}`, [])
  const containerRef = useRef(null)
  const [error, setError] = useState('')
  const [fallbackToImage, setFallbackToImage] = useState(false)
  const fallbackImageUrl = useMemo(() => `https://mermaid.ink/img/${encodeBase64Unicode(code)}`, [code])

  useEffect(() => {
    let isActive = true

    const render = async () => {
      try {
        setError('')
        setFallbackToImage(false)
        const { svg } = await mermaid.render(id, code)
        if (!isActive || !containerRef.current) return
        const sanitizedSvg = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ['foreignObject', 'div', 'span', 'p'],
          ADD_ATTR: ['class', 'style', 'xmlns', 'width', 'height'],
          FORCE_BODY: false,
        })
        containerRef.current.innerHTML = sanitizedSvg

        const hasVisibleText = containerRef.current.querySelector('text, tspan, foreignObject, .label span, .label p, .label div')
        const hasOnlyEmptyLabelGroups = !hasVisibleText && containerRef.current.querySelector('.label')
        if (hasOnlyEmptyLabelGroups) {
          setFallbackToImage(true)
        }
      } catch (err) {
        if (!isActive) return
        setError(err?.message || 'No se pudo renderizar Mermaid')
      }
    }

    render()

    return () => {
      isActive = false
    }
  }, [code, id])

  return (
    <div className="render-block">
      <div className="render-block-header">
        <span className="render-badge">Mermaid</span>
        <button className="render-expand-btn" onClick={() => onExpand({ type: 'mermaid', code })}>
          Ampliar
        </button>
      </div>
      <div className="render-preview mermaid-preview">
        {error ? (
          <div className="render-error">⚠️ {error}</div>
        ) : fallbackToImage ? (
          <div className="mermaid-image-fallback-wrap">
            <img
              src={fallbackImageUrl}
              alt="Mermaid diagram"
              className="mermaid-image-fallback"
              loading="lazy"
            />
          </div>
        ) : (
          <div ref={containerRef} className="mermaid-svg-container" />
        )}
      </div>
      <CodePanel code={code} language="mermaid" />
    </div>
  )
}

function HtmlBlock({ code, onExpand }) {
  const previewDoc = useMemo(() => buildPreviewDocument(code), [code])

  return (
    <div className="render-block">
      <div className="render-block-header">
        <span className="render-badge">HTML Preview</span>
        <button className="render-expand-btn" onClick={() => onExpand({ type: 'html', code })}>
          Ampliar
        </button>
      </div>
      <div className="render-preview html-preview">
        <iframe
          title="HTML preview"
          className="html-preview-frame"
          sandbox="allow-scripts"
          srcDoc={previewDoc}
        />
      </div>
      <CodePanel code={code} language="html" />
    </div>
  )
}

function RichMessage({ content, onExpand }) {
  const blocks = useMemo(() => extractBlocks(content), [content])

  return (
    <div className="message-content markdown-body">
      {blocks.map((block, index) => {
        if (block.type === 'mermaid') {
          return <MermaidBlock key={`mermaid-${index}`} code={block.content} onExpand={onExpand} />
        }

        if (block.type === 'html') {
          return <HtmlBlock key={`html-${index}`} code={block.content} onExpand={onExpand} />
        }

        return (
          <div
            key={`markdown-${index}`}
            className="markdown-fragment"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }}
          />
        )
      })}
    </div>
  )
}

function ExpandedPreviewModal({ preview, onClose }) {
  const isHtml = preview?.type === 'html'
  const iframeDoc = isHtml ? buildPreviewDocument(preview.code) : null

  useEffect(() => {
    if (!preview) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview, onClose])

  if (!preview) return null

  return (
    <div className="preview-modal-backdrop" onClick={onClose}>
      <div className="preview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="preview-modal-header">
          <div>
            <strong>{isHtml ? 'Vista HTML ampliada' : 'Vista Mermaid ampliada'}</strong>
            <div className="preview-modal-subtitle">Preview interactiva + código original</div>
          </div>
          <button className="preview-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="preview-modal-body">
          <div className="preview-modal-stage">
            {isHtml ? (
              <iframe
                title="Expanded HTML preview"
                className="preview-modal-iframe"
                sandbox="allow-scripts"
                srcDoc={iframeDoc}
              />
            ) : (
              <MermaidBlock code={preview.code} onExpand={() => {}} />
            )}
          </div>

          <div className="preview-modal-code-wrap">
            <div className="preview-modal-code-title">Código original</div>
            <pre className="preview-modal-code">
              <code>{preview.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Chat({ messages, onEditMessage, onDeleteMessage }) {
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [expandedPreview, setExpandedPreview] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    <>
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
                    <RichMessage content={message.content} onExpand={setExpandedPreview} />
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

      <ExpandedPreviewModal preview={expandedPreview} onClose={() => setExpandedPreview(null)} />
    </>
  )
}
