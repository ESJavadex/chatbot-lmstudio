export function ModelSelector({ models, selectedModel, onSelectModel }) {
  return (
    <div className="model-selector-modal">
      <h3>Selecciona un modelo</h3>
      <div className="model-grid">
        {models.map(model => {
          const modelName = model.name || model.id || model.display_name || 'unknown-model'
          const isActive = (selectedModel?.id || selectedModel?.name) === (model.id || model.name)
          return (
          <button
            key={model.id || model.name}
            className={`model-card ${isActive ? 'active' : ''}`}
            onClick={() => onSelectModel(model)}
          >
            <span>{modelName}</span>
            <small>{model.params_string || model.size || model.quantization?.name || 'Loaded model'}</small>
          </button>
        )})}
      </div>
    </div>
  )
}
