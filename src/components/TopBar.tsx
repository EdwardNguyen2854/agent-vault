import {
  Bot,
  ChevronDown,
  Command,
  FolderOpen,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Menu,
  Settings,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SavedVault } from '../utils/vaultRegistry';

interface TopBarProps {
  vaultName: string;
  dirty: boolean;
  canSave: boolean;
  sampleMode: boolean;
  onOpenCommandPalette: () => void;
  onOpenVault: () => void;
  onOpenSharedVault: () => void;
  onImportAgentVault: () => void;
  savedVaults: SavedVault[];
  onOpenSavedVault: (id: string) => void | Promise<void>;
  onCreateNote: () => void;
  onRefresh: () => void;
  onSave: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
}

export function TopBar({
  vaultName,
  dirty,
  canSave,
  sampleMode,
  onOpenCommandPalette,
  onOpenVault,
  onOpenSharedVault,
  onImportAgentVault,
  savedVaults,
  onOpenSavedVault,
  onCreateNote,
  onRefresh,
  onSave,
  onToggleSidebar,
  onOpenSettings,
  chatOpen,
  onToggleChat,
}: TopBarProps) {
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  const vaultMenuRef = useRef<HTMLDivElement>(null);

  const runVaultAction = async (action: () => void | Promise<void>) => {
    await action();
    setVaultMenuOpen(false);
  };

  useEffect(() => {
    if (!vaultMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!vaultMenuRef.current?.contains(event.target as Node)) {
        setVaultMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVaultMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [vaultMenuOpen]);

  return (
    <header className="topbar">
      {/* Left: hamburger + brand */}
      <div className="topbar-left">
        <button
          className="icon-btn mobile-nav-toggle"
          onClick={onToggleSidebar}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu size={16} />
        </button>
        <div className="brand-mark">
          <div className="brand-logo" aria-hidden="true">
            <Bot size={14} />
          </div>
          <div className="brand-text">
            <strong>Agent Vault</strong>
            <span className="vault-name-label">{vaultName}</span>
          </div>
        </div>
      </div>

      {/* Center: command center trigger */}
      <div className="topbar-center">
        <button
          className="command-trigger"
          onClick={onOpenCommandPalette}
          aria-label="Open command center"
          title="Command center — Ctrl+K / Cmd+K"
        >
          <Command size={13} aria-hidden="true" />
          <span>Search notes, commands, tags...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      {/* Right: actions */}
      <div className="topbar-actions">
        <button
          className="primary-button"
          onClick={onCreateNote}
          disabled={sampleMode}
          title="Create new note"
          aria-label="Create new note"
        >
          <Plus size={14} />
          <span className="btn-label">New note</span>
        </button>
        {canSave && (
          <button
            className={`save-chip ${dirty ? 'dirty' : ''}`}
            onClick={onSave}
            disabled={!dirty}
            aria-label={dirty ? 'Save changes' : 'All changes saved'}
            title={dirty ? 'Save (Ctrl+S)' : 'All changes saved'}
          >
            <Save size={12} aria-hidden="true" />
            <span>{dirty ? 'Save' : 'Saved'}</span>
          </button>
        )}
        <button
          className={`icon-btn${chatOpen ? ' active' : ''}`}
          onClick={onToggleChat}
          title="Toggle chat (Cmd/Ctrl+Shift+C)"
          aria-label="Toggle chat"
        >
          <MessageSquare size={14} />
        </button>
        <div className="vault-menu" ref={vaultMenuRef}>
          <button
            className="ghost-button vault-menu-trigger"
            onClick={() => setVaultMenuOpen((v) => !v)}
            aria-expanded={vaultMenuOpen}
            aria-haspopup="menu"
            title="Vault actions"
          >
            <FolderOpen size={14} />
            <span className="btn-label">Vault</span>
            <ChevronDown size={12} />
          </button>
          {vaultMenuOpen && (
            <div className="vault-menu-dropdown" role="menu">
              {savedVaults.length > 0 && (
                <>
                  <div className="vault-menu-label">Quick switch</div>
                  {savedVaults.slice(0, 6).map((vault) => (
                    <button
                      key={vault.id}
                      type="button"
                      role="menuitem"
                      onClick={() => void runVaultAction(() => onOpenSavedVault(vault.id))}
                    >
                      <FolderOpen size={13} />
                      <span>{vault.defaultPersonal ? `${vault.name} · default` : vault.name}</span>
                    </button>
                  ))}
                  <div className="vault-menu-separator" />
                </>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => void runVaultAction(onOpenVault)}
              >
                <FolderOpen size={13} />
                <span>Open personal vault</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void runVaultAction(onOpenSharedVault)}
              >
                <FolderOpen size={13} />
                <span>Add shared vault</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void runVaultAction(onImportAgentVault)}
              >
                <Bot size={13} />
                <span>Import agent vault</span>
              </button>
              <button type="button" role="menuitem" onClick={() => void runVaultAction(onRefresh)}>
                <RefreshCw size={13} />
                <span>Refresh vaults</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void runVaultAction(onOpenSettings)}
              >
                <Settings size={13} />
                <span>Vault settings</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
