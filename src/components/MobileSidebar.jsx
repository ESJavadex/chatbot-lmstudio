export function MobileSidebar({ children, isOpen, onClose }) {
  if (!isOpen) return null

  const handleRootClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="mobile-sidebar-root"
      role="dialog"
      aria-modal="true"
      aria-label="Panel lateral"
      onClick={handleRootClick}
    >
      <div className="mobile-sidebar-panel-wrap">
        <aside className="mobile-sidebar-panel">
          <div className="mobile-sidebar-topbar">
            <div className="mobile-sidebar-title">Workspace</div>
            <button
              type="button"
              className="mobile-sidebar-close"
              aria-label="Cerrar panel lateral"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div className="mobile-sidebar-content">
            {children}
          </div>
        </aside>
      </div>
    </div>
  )
}
