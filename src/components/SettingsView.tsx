import {
  AlertCircle,
  Bot,
  Brain,
  Database,
  Eye,
  FolderOpen,
  Globe,
  Keyboard,
  List,
  Maximize2,
  MemoryStick,
  MessageSquare,
  Moon,
  PanelRight,
  Settings,
  Shield,
  Sparkles,
  Sun,
  TestTube,
  ToggleLeft,
  ToggleRight,
  Toolbox,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { checkConnection, getModels, testConnection, type LMStudioConfig } from '../utils/lmstudio';
import { loadLastVaultName } from '../utils/preferences';
import type { ThemeMode } from '../utils/preferences';
import {
  loadAgentRunsSettings,
  loadAIProviderConfig,
  loadContextSettings,
  loadMemorySettings,
  loadSkillsSettings,
  loadToolsSettings,
  saveAgentRunsSettings,
  saveAIProviderConfig,
  saveContextSettings,
  saveMemorySettings,
  saveSkillsSettings,
  saveToolsSettings,
  type AgentRunsSettings,
  type AIProvider,
  type AIProviderConfig,
  type ChatLayout,
  type UIContextSettings as ContextSettings,
  type MemorySettings,
  type SkillsSettings,
  type ToolsSettings,
} from '../utils/settings';
import type { SavedVault } from '../utils/vaultRegistry';
import { getAlwaysAllowIds, getPermissionLog, removeAlwaysAllowId } from '../utils/permissions';

// ============================================================================
// Settings View Component
// ============================================================================

interface SettingsViewProps {
  vaultName: string;
  sampleMode: boolean;
  personalVaultCount: number;
  personalVaultIds: string[];
  sharedVaultCount: number;
  sharedVaultIds: string[];
  agentVaultCount: number;
  agentVaultIds: string[];
  savedVaults: SavedVault[];
  onOpenVault: () => void;
  onOpenSharedVault: () => void;
  onImportAgentVault: () => void;
  onOpenSavedVault: (id: string) => void;
  onMakeDefaultVault: (id: string) => void;
  onUnplugVault: (id: string) => void | Promise<void>;
  onResetVaultRegistry: () => void | Promise<void>;
  currentTheme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  showProperties: boolean;
  onShowPropertiesChange: (value: boolean) => void;
  expandFileTree: boolean;
  onExpandFileTreeChange: (value: boolean) => void;
  chatLayout: ChatLayout;
  onChatLayoutChange: (layout: ChatLayout) => void;
  appVersion?: string;
  onChangeView?: (view: 'about') => void;
}

export function SettingsView({
  vaultName,
  sampleMode,
  personalVaultCount,
  personalVaultIds,
  sharedVaultCount,
  sharedVaultIds,
  agentVaultCount,
  agentVaultIds,
  savedVaults,
  onOpenVault,
  onOpenSharedVault,
  onImportAgentVault,
  onOpenSavedVault,
  onMakeDefaultVault,
  onUnplugVault,
  onResetVaultRegistry,
  currentTheme,
  onChangeTheme,
  showProperties,
  onShowPropertiesChange,
  expandFileTree,
  onExpandFileTreeChange,
  chatLayout,
  onChatLayoutChange,
  appVersion,
  onChangeView,
}: SettingsViewProps) {
  const [lastVaultName, setLastVaultName] = useState(() => loadLastVaultName());
  const [activeTab, setActiveTab] = useState<'ai' | 'agent' | 'vaults' | 'preferences' | 'about'>(
    'ai',
  );

  // AI Provider State
  const [aiConfig, setAIConfig] = useState<AIProviderConfig>(() => loadAIProviderConfig());
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [detectedModel, setDetectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');

  // Context Settings State
  const [contextSettings, setContextSettings] = useState<ContextSettings>(() =>
    loadContextSettings(),
  );

  // Skills Settings State
  const [skillsSettings, setSkillsSettings] = useState<SkillsSettings>(() => loadSkillsSettings());

  // Memory Settings State
  const [memorySettings, setMemorySettings] = useState<MemorySettings>(() => loadMemorySettings());

  // Tools Settings State
  const [toolsSettings, setToolsSettings] = useState<ToolsSettings>(() => loadToolsSettings());
  const [alwaysAllowedTools, setAlwaysAllowedTools] = useState<Set<string>>(() =>
    getAlwaysAllowIds(),
  );
  const [permissionLog, setPermissionLog] = useState(() => getPermissionLog().slice(-8).reverse());

  // Agent Runs State
  const [agentRunsSettings, setAgentRunsSettings] = useState<AgentRunsSettings>(() =>
    loadAgentRunsSettings(),
  );

  // Persist AI config changes
  useEffect(() => {
    saveAIProviderConfig(aiConfig);
  }, [aiConfig]);

  // Persist context settings changes
  useEffect(() => {
    saveContextSettings(contextSettings);
  }, [contextSettings]);

  // Persist skills settings changes
  useEffect(() => {
    saveSkillsSettings(skillsSettings);
  }, [skillsSettings]);

  // Persist memory settings changes
  useEffect(() => {
    saveMemorySettings(memorySettings);
  }, [memorySettings]);

  // Persist tools settings changes
  useEffect(() => {
    saveToolsSettings(toolsSettings);
  }, [toolsSettings]);

  // Persist agent runs settings changes
  useEffect(() => {
    saveAgentRunsSettings(agentRunsSettings);
  }, [agentRunsSettings]);

  // Load models when base URL changes
  const loadAvailableModels = useCallback(
    async (baseUrl: string) => {
      setModelsLoading(true);
      setModelsError('');
      try {
        const models = await getModels({ ...aiConfig.lmStudio, baseUrl });
        setAvailableModels(models);
      } catch (err) {
        setModelsError('Failed to load models');
        setAvailableModels([]);
      } finally {
        setModelsLoading(false);
      }
    },
    [aiConfig.lmStudio],
  );

  // Auto-pick the first available model when none is configured
  useEffect(() => {
    if (availableModels.length > 0 && !aiConfig.lmStudio.modelName) {
      setAIConfig((prev) => ({
        ...prev,
        lmStudio: { ...prev.lmStudio, modelName: availableModels[0] },
      }));
    }
  }, [availableModels, aiConfig.lmStudio.modelName]);

  // Test connection handler
  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionMessage('');
    setDetectedModel('');

    try {
      const result = await testConnection(aiConfig.lmStudio);

      if (result.success) {
        setConnectionStatus('success');
        setConnectionMessage('Connected successfully!');
        setDetectedModel(result.model || aiConfig.lmStudio.modelName);

        // Refresh models list
        loadAvailableModels(aiConfig.lmStudio.baseUrl);
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.error || 'Connection failed');
      }
    } catch (err) {
      setConnectionStatus('error');
      setConnectionMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Update LM Studio config
  const updateLMStudioConfig = (updates: Partial<LMStudioConfig>) => {
    setAIConfig((prev) => ({
      ...prev,
      lmStudio: { ...prev.lmStudio, ...updates },
    }));
    setConnectionStatus('idle');
    setConnectionMessage('');
  };

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Sparkles },
  ];

  const handleResetVaultRegistry = async () => {
    if (
      !window.confirm(
        'Hard reset vault registrations? This forgets saved vault handles and the default vault, but does not delete markdown files.',
      )
    )
      return;
    await onResetVaultRegistry();
    setLastVaultName(null);
  };

  const handleUnplug = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Unplug "${name}" from this session? Files on disk are untouched. You can re-open it later from the Vault menu.`,
      )
    )
      return;
    await onUnplugVault(id);
  };

  const handleRevokeAlwaysAllowed = (toolId: string) => {
    removeAlwaysAllowId(toolId);
    setAlwaysAllowedTools(getAlwaysAllowIds());
    setPermissionLog(getPermissionLog().slice(-8).reverse());
  };

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Workspace setup</span>
          <h1>
            <Database size={20} /> Settings
          </h1>
          <p>Agent Vault is local-first and stores notes in your selected folder.</p>
        </div>
      </div>

      <div className="settings-tab-bar">
        {(['ai', 'agent', 'vaults', 'preferences', 'about'] as const).map((tab) => (
          <button
            key={tab}
            className={`ghost-button${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'ai'
              ? 'AI Provider'
              : tab === 'agent'
                ? 'Agent'
                : tab === 'vaults'
                  ? 'Vaults'
                  : tab === 'preferences'
                    ? 'Preferences'
                    : 'About'}
          </button>
        ))}
      </div>

      <div className="settings-grid">
        {/* AI Provider Section */}
        {activeTab === 'ai' && (
          <>
            <section className="panel-card">
              <h3>
                <Bot size={15} /> AI Provider
              </h3>
              <p style={{ marginBottom: 16, color: 'var(--muted)', fontSize: 13 }}>
                Configure your AI backend for Agent Vault v2 functionality. LM Studio provides a
                local, private inference server.
              </p>

              {/* Provider Selection */}
              <div className="settings-field">
                <label htmlFor="provider-select">Provider</label>
                <select
                  id="provider-select"
                  className="settings-select"
                  value={aiConfig.provider}
                  onChange={(e) =>
                    setAIConfig((prev) => ({ ...prev, provider: e.target.value as AIProvider }))
                  }
                >
                  <option value="lmstudio">LM Studio</option>
                  <option value="openai" disabled>
                    OpenAI (coming soon)
                  </option>
                  <option value="anthropic" disabled>
                    Anthropic (coming soon)
                  </option>
                </select>
              </div>

              {/* LM Studio Configuration */}
              {aiConfig.provider === 'lmstudio' && (
                <>
                  {/* Base URL */}
                  <div className="settings-field">
                    <label htmlFor="base-url">Base URL</label>
                    <input
                      id="base-url"
                      type="text"
                      className="settings-input"
                      value={aiConfig.lmStudio.baseUrl}
                      onChange={(e) => updateLMStudioConfig({ baseUrl: e.target.value })}
                      placeholder="/lms/v1"
                    />
                  </div>

                  {/* Streaming Toggle */}
                  <div className="settings-field">
                    <label className="settings-toggle-label">
                      <span>Streaming Responses</span>
                      <button
                        className={`toggle-button ${aiConfig.lmStudio.streaming ? 'active' : ''}`}
                        onClick={() =>
                          updateLMStudioConfig({ streaming: !aiConfig.lmStudio.streaming })
                        }
                        type="button"
                      >
                        {aiConfig.lmStudio.streaming ? (
                          <ToggleRight size={20} />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                        <span>{aiConfig.lmStudio.streaming ? 'On' : 'Off'}</span>
                      </button>
                    </label>
                  </div>

                  {/* Model Picker */}
                  <div className="settings-field">
                    <label htmlFor="model-select">Model</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        id="model-select"
                        className="settings-select"
                        style={{ flex: 1 }}
                        value={aiConfig.lmStudio.modelName}
                        onChange={(e) => updateLMStudioConfig({ modelName: e.target.value })}
                        disabled={modelsLoading}
                      >
                        {modelsLoading ? (
                          <option value="">Loading models...</option>
                        ) : availableModels.length > 0 ? (
                          <>
                            <option value="">Select a model...</option>
                            {availableModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value={aiConfig.lmStudio.modelName || 'local-model'}>
                            {aiConfig.lmStudio.modelName || 'local-model'}
                          </option>
                        )}
                      </select>
                      <button
                        className="ghost-button"
                        onClick={() => loadAvailableModels(aiConfig.lmStudio.baseUrl)}
                        disabled={modelsLoading}
                        title="Refresh models"
                      >
                        <Globe size={14} />
                      </button>
                    </div>
                    {modelsError && <span className="settings-error">{modelsError}</span>}
                    {availableModels.length === 0 && !modelsLoading && !modelsError && (
                      <span className="settings-hint">
                        No models found. Make sure LM Studio is running with a model loaded.
                      </span>
                    )}
                  </div>

                  {/* Test Connection */}
                  <div className="settings-field">
                    <button
                      className={`primary-button ${connectionStatus === 'testing' ? 'loading' : ''}`}
                      onClick={handleTestConnection}
                      disabled={connectionStatus === 'testing'}
                    >
                      <TestTube size={14} />
                      {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                    </button>
                    {connectionStatus === 'success' && (
                      <div className="connection-status success">
                        <span>{connectionMessage}</span>
                        {detectedModel && (
                          <span className="model-detected">Detected: {detectedModel}</span>
                        )}
                      </div>
                    )}
                    {connectionStatus === 'error' && (
                      <div className="connection-status error">
                        <span>{connectionMessage}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* Context Settings Section */}
        {activeTab === 'agent' && (
          <>
            <section className="panel-card">
              <h3>
                <Brain size={15} /> Context Settings
              </h3>
              <p style={{ marginBottom: 12, color: 'var(--muted)', fontSize: 13 }}>
                Configure how context is gathered for agent conversations.
              </p>

              <div className="settings-field">
                <label htmlFor="context-depth">Default Context Depth</label>
                <select
                  id="context-depth"
                  className="settings-select"
                  value={contextSettings.defaultDepth}
                  onChange={(e) =>
                    setContextSettings((prev) => ({
                      ...prev,
                      defaultDepth: Number(e.target.value) as 1 | 2,
                    }))
                  }
                >
                  <option value={1}>1-hop (direct links only)</option>
                  <option value={2}>2-hop (links of links)</option>
                </select>
              </div>

              <div className="settings-field">
                <label htmlFor="max-context">Max Context Size (tokens)</label>
                <input
                  id="max-context"
                  type="number"
                  className="settings-input"
                  value={contextSettings.maxContextSize}
                  onChange={(e) =>
                    setContextSettings((prev) => ({
                      ...prev,
                      maxContextSize: parseInt(e.target.value) || 4096,
                    }))
                  }
                  min={512}
                  max={128000}
                  step={512}
                />
              </div>

              <div className="settings-toggles">
                <label className="settings-toggle-label">
                  <input
                    type="checkbox"
                    checked={contextSettings.includeBacklinks}
                    onChange={(e) =>
                      setContextSettings((prev) => ({
                        ...prev,
                        includeBacklinks: e.target.checked,
                      }))
                    }
                  />
                  <span>Include backlinks by default</span>
                </label>

                <label className="settings-toggle-label">
                  <input
                    type="checkbox"
                    checked={contextSettings.includeMemory}
                    onChange={(e) =>
                      setContextSettings((prev) => ({ ...prev, includeMemory: e.target.checked }))
                    }
                  />
                  <span>Include memory by default</span>
                </label>

                <label className="settings-toggle-label">
                  <input
                    type="checkbox"
                    checked={contextSettings.includeTools}
                    onChange={(e) =>
                      setContextSettings((prev) => ({ ...prev, includeTools: e.target.checked }))
                    }
                  />
                  <span>Include tools by default</span>
                </label>
              </div>
            </section>

            {/* Skills Settings Section */}
            <section className="panel-card">
              <h3>
                <Sparkles size={15} /> Skills
              </h3>

              <div className="settings-field">
                <label>Skills Folder Path</label>
                <input
                  type="text"
                  className="settings-input"
                  value={skillsSettings.folderPath}
                  onChange={(e) =>
                    setSkillsSettings((prev) => ({ ...prev, folderPath: e.target.value }))
                  }
                  placeholder=".opencode/skills"
                />
              </div>

              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={skillsSettings.showInactive}
                  onChange={(e) =>
                    setSkillsSettings((prev) => ({ ...prev, showInactive: e.target.checked }))
                  }
                />
                <span>Show inactive skills</span>
              </label>
            </section>

            {/* Memory Settings Section */}
            <section className="panel-card">
              <h3>
                <MemoryStick size={15} /> Memory
              </h3>

              <div className="settings-field">
                <label>Memory Folder Path</label>
                <input
                  type="text"
                  className="settings-input"
                  value={memorySettings.folderPath}
                  onChange={(e) =>
                    setMemorySettings((prev) => ({ ...prev, folderPath: e.target.value }))
                  }
                  placeholder=".agent-memory"
                />
              </div>

              <div className="settings-field">
                <label>Save-to-Memory Default Location</label>
                <input
                  type="text"
                  className="settings-input"
                  value={memorySettings.saveLocation}
                  onChange={(e) =>
                    setMemorySettings((prev) => ({ ...prev, saveLocation: e.target.value }))
                  }
                  placeholder=".agent-memory/sessions"
                />
              </div>

              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={memorySettings.requireApproval}
                  onChange={(e) =>
                    setMemorySettings((prev) => ({ ...prev, requireApproval: e.target.checked }))
                  }
                />
                <span>Require approval before saving to memory</span>
              </label>
            </section>

            {/* Tools Settings Section */}
            <section className="panel-card">
              <h3>
                <Toolbox size={15} /> Tools
              </h3>

              <div className="settings-field">
                <label>MCP Config Path</label>
                <input
                  type="text"
                  className="settings-input"
                  value={toolsSettings.mcpConfigPath}
                  onChange={(e) =>
                    setToolsSettings((prev) => ({ ...prev, mcpConfigPath: e.target.value }))
                  }
                  placeholder=".opencode/mcp.json"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="tool-permission">Tool Permission Default</label>
                <select
                  id="tool-permission"
                  className="settings-select"
                  value={toolsSettings.defaultPermission}
                  onChange={(e) =>
                    setToolsSettings((prev) => ({
                      ...prev,
                      defaultPermission: e.target.value as 'ask' | 'trusted' | 'read-only',
                    }))
                  }
                >
                  <option value="ask">Ask each time</option>
                  <option value="trusted">Trusted (allow all)</option>
                  <option value="read-only">Read-only mode</option>
                </select>
              </div>

              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={toolsSettings.showRiskLabels}
                  onChange={(e) =>
                    setToolsSettings((prev) => ({ ...prev, showRiskLabels: e.target.checked }))
                  }
                />
                <span>Show tool risk labels</span>
              </label>

              <div className="detail-drawer-section">
                <h4>Always-Allowed Tools</h4>
                {alwaysAllowedTools.size > 0 ? (
                  <div className="metadata-list spacious">
                    {[...alwaysAllowedTools].map((toolId) => (
                      <div key={toolId}>
                        <span>{toolId}</span>
                        <button
                          className="ghost-button"
                          onClick={() => handleRevokeAlwaysAllowed(toolId)}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                    No always-allowed tools.
                  </p>
                )}
              </div>

              {permissionLog.length > 0 && (
                <div className="detail-drawer-section">
                  <h4>Recent Permission Grants</h4>
                  <div className="metadata-list spacious">
                    {permissionLog.map((entry) => (
                      <div key={`${entry.timestamp}-${entry.toolId}-${entry.decision}`}>
                        <span>
                          {entry.toolName} · {entry.decision.replace('_', ' ')}
                        </span>
                        <strong>{new Date(entry.timestamp).toLocaleString()}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Agent Runs Section */}
            <section className="panel-card">
              <h3>
                <List size={15} /> Agent Runs
              </h3>

              <div className="settings-field">
                <label>Run Log Folder</label>
                <input
                  type="text"
                  className="settings-input"
                  value={agentRunsSettings.logFolderPath}
                  onChange={(e) =>
                    setAgentRunsSettings((prev) => ({ ...prev, logFolderPath: e.target.value }))
                  }
                  placeholder="Agent Runs"
                />
              </div>

              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={agentRunsSettings.autoSaveRuns}
                  onChange={(e) =>
                    setAgentRunsSettings((prev) => ({ ...prev, autoSaveRuns: e.target.checked }))
                  }
                />
                <span>Auto-save runs</span>
              </label>

              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={agentRunsSettings.includeToolOutput}
                  onChange={(e) =>
                    setAgentRunsSettings((prev) => ({
                      ...prev,
                      includeToolOutput: e.target.checked,
                    }))
                  }
                />
                <span>Include tool output in logs</span>
              </label>
            </section>
          </>
        )}

        {/* Vaults Section */}
        {activeTab === 'vaults' && (
          <>
            <section className="panel-card">
              <h3>
                <Database size={15} /> Vaults
              </h3>
              <div className="metadata-list spacious">
                <div>
                  <span>Agent Vault</span>
                  <strong>Loaded read-only</strong>
                </div>
                <div>
                  <span>Imported Agent Vaults</span>
                  <strong>{agentVaultCount}</strong>
                </div>
                <div>
                  <span>Personal Vaults</span>
                  <strong>
                    {personalVaultCount === 0
                      ? 'None selected'
                      : personalVaultCount === 1
                        ? vaultName
                        : `${personalVaultCount} mounted`}
                  </strong>
                </div>
                <div>
                  <span>Shared Vaults</span>
                  <strong>{sharedVaultCount}</strong>
                </div>
                <div>
                  <span>Storage</span>
                  <strong>File System Access API</strong>
                </div>
                {lastVaultName && (
                  <div>
                    <span>Last vault</span>
                    <strong>{lastVaultName}</strong>
                  </div>
                )}
              </div>
              <button className="primary-button wide" onClick={onOpenVault}>
                <FolderOpen size={14} /> Open another personal vault folder
              </button>
              <button className="ghost-button wide" onClick={onImportAgentVault}>
                <Bot size={14} /> Import Agent Vault folder
              </button>
              <button className="ghost-button wide" onClick={onOpenSharedVault}>
                <FolderOpen size={14} /> Add shared vault read-only
              </button>
              <button className="ghost-button wide danger" onClick={handleResetVaultRegistry}>
                <AlertCircle size={14} /> Hard reset vault registrations
              </button>
              {savedVaults.length > 0 &&
                (() => {
                  const personalSet = new Set(personalVaultIds);
                  const sharedSet = new Set(sharedVaultIds);
                  const agentSet = new Set(agentVaultIds);
                  const mountedSet = new Set(
                    savedVaults
                      .filter((vault) => {
                        if (vault.role === 'personal') return personalSet.has(vault.id);
                        if (vault.role === 'shared') return sharedSet.has(vault.id);
                        return agentSet.has(vault.id);
                      })
                      .map((vault) => vault.id),
                  );
                  const mountedRows = savedVaults.filter((vault) => mountedSet.has(vault.id));
                  const savedRows = savedVaults.filter((vault) => !mountedSet.has(vault.id));
                  return (
                    <>
                      {mountedRows.length > 0 && (
                        <div className="saved-vault-list">
                          <h4
                            style={{
                              margin: '16px 0 8px',
                              fontSize: 12,
                              color: 'var(--muted)',
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            Mounted this session
                          </h4>
                          {mountedRows.map((vault) => {
                            const roleLabel =
                              vault.role === 'personal'
                                ? 'Personal vault'
                                : vault.role === 'agent'
                                  ? 'Agent vault'
                                  : 'Shared vault';
                            return (
                              <div key={vault.id} className="saved-vault-row">
                                <div>
                                  <strong>{vault.name}</strong>
                                  <span>
                                    {roleLabel}
                                    {vault.defaultPersonal ? ' · default' : ''}
                                    {' · mounted'}
                                  </span>
                                </div>
                                <div className="saved-vault-actions">
                                  {vault.role === 'personal' && !vault.defaultPersonal && (
                                    <button
                                      className="ghost-button"
                                      onClick={() => onMakeDefaultVault(vault.id)}
                                    >
                                      Set default
                                    </button>
                                  )}
                                  <button
                                    className="ghost-button danger"
                                    onClick={() => handleUnplug(vault.id, vault.name)}
                                  >
                                    Unplug
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {savedRows.length > 0 && (
                        <div className="saved-vault-list">
                          <h4
                            style={{
                              margin: mountedRows.length > 0 ? 16 : 0,
                              marginBottom: 8,
                              fontSize: 12,
                              color: 'var(--muted)',
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            Saved (not mounted)
                          </h4>
                          {savedRows.map((vault) => {
                            const roleLabel =
                              vault.role === 'personal'
                                ? 'Personal vault'
                                : vault.role === 'agent'
                                  ? 'Agent vault'
                                  : 'Shared vault';
                            return (
                              <div key={vault.id} className="saved-vault-row">
                                <div>
                                  <strong>{vault.name}</strong>
                                  <span>
                                    {roleLabel}
                                    {vault.defaultPersonal ? ' · default' : ''}
                                  </span>
                                </div>
                                <div className="saved-vault-actions">
                                  <button
                                    className="ghost-button"
                                    onClick={() => onOpenSavedVault(vault.id)}
                                  >
                                    Open
                                  </button>
                                  {vault.role === 'personal' && !vault.defaultPersonal && (
                                    <button
                                      className="ghost-button"
                                      onClick={() => onMakeDefaultVault(vault.id)}
                                    >
                                      Set default
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
            </section>
          </>
        )}

        {activeTab === 'preferences' && (
          <>
            <section className="panel-card">
              <h3>
                <Sun size={15} /> Theme
              </h3>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      className={`ghost-button ${currentTheme === opt.value ? 'active' : ''}`}
                      onClick={() => onChangeTheme(opt.value)}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                {currentTheme === 'light'
                  ? 'White theme active.'
                  : currentTheme === 'dark'
                    ? 'Dark theme active.'
                    : 'Follows your system preference.'}
              </p>
            </section>

            <section className="panel-card">
              <h3>
                <Eye size={15} /> Display
              </h3>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={showProperties}
                  onChange={(e) => onShowPropertiesChange(e.target.checked)}
                />
                <span>Expand properties by default</span>
              </label>
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                When off, properties start collapsed and can be expanded per note.
              </p>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={expandFileTree}
                  onChange={(e) => onExpandFileTreeChange(e.target.checked)}
                />
                <span>Expand all folders by default</span>
              </label>
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                When off, the file tree remembers which folders you collapsed and restores them on
                next launch.
              </p>
              <div style={{ marginTop: 16 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)' }}>
                  Chat layout
                </h4>
                <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Chat layout">
                  {[
                    { value: 'docked' as const, label: 'Right bar', icon: PanelRight },
                    { value: 'floating' as const, label: 'Popup', icon: MessageSquare },
                    { value: 'fullpage' as const, label: 'Fullpage', icon: Maximize2 },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`ghost-button ${chatLayout === opt.value ? 'active' : ''}`}
                        onClick={() => onChatLayoutChange(opt.value)}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Icon size={14} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'about' && (
          <>
            <section className="panel-card">
              <h3>
                <AlertCircle size={15} /> Browser requirement
              </h3>
              <p>
                Local folder read/write requires <strong>Chrome</strong> or{' '}
                <strong>Microsoft Edge</strong>. Firefox and Safari can view the app but cannot save
                edits to local folders.
              </p>
            </section>

            <section className="panel-card">
              <h3>
                <Keyboard size={15} /> Shortcuts
              </h3>
              <div className="shortcut-list">
                <div>
                  <kbd>Ctrl</kbd>
                  <kbd>S</kbd>
                  <span>Save note</span>
                </div>
                <div>
                  <kbd>Ctrl</kbd>
                  <kbd>K</kbd>
                  <span>Command palette</span>
                </div>
                <div>
                  <kbd>Ctrl</kbd>
                  <kbd>N</kbd>
                  <span>Create note</span>
                </div>
                <div>
                  <kbd>Ctrl</kbd>
                  <kbd>,</kbd>
                  <span>Open settings</span>
                </div>
              </div>
            </section>

            <section className="panel-card">
              <h3>
                <Shield size={15} /> Privacy
              </h3>
              <p>
                Notes stay on your machine. The app does not upload vault content unless you add
                your own backend or sync provider later.
              </p>
            </section>

            <section className="panel-card">
              <h3>
                <Sparkles size={15} /> Version
              </h3>
              <p>
                Running Agent Vault{' '}
                {appVersion ? (
                  <>
                    <strong>v{appVersion}</strong>.{' '}
                  </>
                ) : null}
                Open the <em>About</em> page from the sidebar for the full feature overview, release
                notes, and roadmap.
              </p>
              {onChangeView && (
                <button
                  type="button"
                  className="settings-about-link"
                  onClick={() => onChangeView('about')}
                >
                  Open About page
                </button>
              )}
            </section>
          </>
        )}
      </div>

      {/* Settings styles */}
      <style>{`
        .settings-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 800px;
          margin: 0 auto;
          padding: 0 0 40px 0;
        }

        .settings-about-link {
          margin-top: 12px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: var(--primary);
          background: transparent;
          border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
          border-radius: 6px;
          cursor: pointer;
          align-self: flex-start;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }

        .settings-about-link:hover {
          background: var(--primary-soft);
          border-color: var(--primary);
          color: var(--primary);
        }

        .settings-tab-bar {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .settings-tab-bar .ghost-button {
          flex: 0 1 auto;
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }

        .settings-tab-bar .ghost-button:hover {
          background: var(--hover);
          color: var(--text);
        }

        .settings-tab-bar .ghost-button.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        .settings-field {
          margin-bottom: 16px;
        }

        .settings-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--muted);
          margin-bottom: 6px;
        }

        .settings-input,
        .settings-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          transition: border-color 0.15s;
        }

        .settings-input:focus,
        .settings-select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .settings-select {
          cursor: pointer;
        }

        .settings-toggle-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          cursor: pointer;
          padding: 6px 0;
        }

        .settings-toggle-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--accent);
        }

        .toggle-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg);
          color: var(--text);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .toggle-button:hover {
          background: var(--hover);
        }

        .toggle-button.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        .settings-toggles {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
        }

        .settings-hint {
          display: block;
          font-size: 11px;
          color: var(--muted);
          margin-top: 4px;
        }

        .settings-error {
          display: block;
          font-size: 11px;
          color: var(--error);
          margin-top: 4px;
        }

        .connection-status {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 13px;
        }

        .connection-status.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .connection-status.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .model-detected {
          font-size: 12px;
          opacity: 0.8;
        }

        .primary-button.loading {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}
