import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  LayoutGrid,
  Link2,
  List,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Terminal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Tool, ToolPermission, VaultNote } from '../types';
import {
  formatPermission,
  formatRisk,
  getRelatedAgentsForTool,
  getRelatedSkillsForTool,
  getRiskColorClass,
  getPermissionColorClass,
  getAllTools,
  isToolNote,
  loadToolMetadata,
} from '../utils/tools';
import { getNoteKey } from '../utils/noteKey';
import { checkBridgeHealth, getCachedBridgeStatus, invokeBridgeTool } from '../utils/bridgeClient';
import { getMcpServers } from '../utils/mcp';
import { getAlwaysAllowIds, getPermissionLog, removeAlwaysAllowId } from '../utils/permissions';
import { getToolUsage } from '../utils/usageStore';

interface ToolsViewProps {
  notes: VaultNote[];
  onSelectNote: (key: string) => void;
  onToolPermissionChange: (toolId: string, permission: ToolPermission) => void | Promise<void>;
  onRegisterMcpTool: (tool: {
    server: string;
    name: string;
    toolId: string;
    description: string;
    permission: ToolPermission;
    risk: 'low' | 'medium' | 'high';
  }) => void | Promise<void>;
  onRegisterMarkitdown?: () => void | Promise<void>;
  onMarkitdownConvert?: (request: {
    uri: string;
    fileType?: string;
    suggestedTitle?: string;
  }) => Promise<{ success: boolean; error?: string; path?: string }>;
}

type ToolCategory = 'all' | 'internal' | 'mcp' | 'disabled';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';
type SortMode = 'alpha' | 'recent' | 'risk';
type ViewMode = 'grid' | 'list';
type McpServerFilter = 'all' | string;

const PERMISSION_OPTIONS: ToolPermission[] = [
  'disabled',
  'ask',
  'read-only',
  'vault-only',
  'trusted',
];
const RISK_OPTIONS: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

const STARTER_TOOL_YAML = `---
type: tool
name: vault-reader
tool_id: vault.read_note
provider: internal
status: active
permission: read-only
risk: low
---

# Vault Reader

Read markdown notes from the current vault.`;

function getPermissionIcon(permission: ToolPermission) {
  switch (permission) {
    case 'disabled':
      return <ShieldOff size={14} />;
    case 'ask':
      return <ShieldAlert size={14} />;
    case 'read-only':
      return <Shield size={14} />;
    case 'vault-only':
      return <Shield size={14} />;
    case 'trusted':
      return <ShieldCheck size={14} />;
  }
}

type DecisionMeta = {
  label: string;
  shortLabel: string;
  icon: typeof CheckCircle2;
  tone: 'positive' | 'warning' | 'danger' | 'muted';
};

const DECISION_META: Record<'allow_once' | 'allow_session' | 'always_allow', DecisionMeta> = {
  allow_once: { label: 'Allow once', shortLabel: 'Once', icon: CheckCircle2, tone: 'muted' },
  allow_session: {
    label: 'Allow for session',
    shortLabel: 'Session',
    icon: CheckCircle2,
    tone: 'warning',
  },
  always_allow: {
    label: 'Always allow',
    shortLabel: 'Always',
    icon: ShieldCheck,
    tone: 'positive',
  },
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return new Date(timestamp).toLocaleString();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function getStatusIcon(status: Tool['status']) {
  switch (status) {
    case 'active':
      return <CheckCircle2 size={12} className="status-active" />;
    case 'inactive':
      return <X size={12} className="status-inactive" />;
    case 'error':
      return <AlertTriangle size={12} className="status-error" />;
    case 'disconnected':
      return <X size={12} className="status-disconnected" />;
  }
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Never checked';
  return new Date(timestamp).toLocaleString();
}

export function ToolsView({
  notes,
  onSelectNote,
  onToolPermissionChange,
  onRegisterMcpTool,
  onRegisterMarkitdown,
  onMarkitdownConvert,
}: ToolsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>('all');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<import('../types').BridgeStatus>('disconnected');
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [alwaysAllowed, setAlwaysAllowed] = useState<Set<string>>(() => getAlwaysAllowIds());
  const [permissionLog, setPermissionLog] = useState(() => getPermissionLog().slice().reverse());
  const [logFilter, setLogFilter] = useState<'all' | 'always' | 'session' | 'once'>('all');

  // New filter / sort / view state
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('alpha');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [mcpServerFilter, setMcpServerFilter] = useState<McpServerFilter>('all');
  const [grantsExpanded, setGrantsExpanded] = useState<boolean>(true);

  // Check bridge health periodically
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const health = await checkBridgeHealth();
      if (mounted) {
        setBridgeStatus(health.status);
        setLastCheckedAt(Date.now());
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-register MarkItDown the first time the user opens the Tools view
  // if the bridge is reachable and the server isn't already configured.
  useEffect(() => {
    if (!onRegisterMarkitdown) return;
    let cancelled = false;
    (async () => {
      try {
        const health = await checkBridgeHealth();
        if (cancelled) return;
        if (health.status !== 'connected') return;
        const config = getMcpServers();
        if (config.servers.some((s) => s.name === 'markitdown')) return;
        await onRegisterMarkitdown();
      } catch {
        // bridge not reachable yet — user can still click the button manually
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onRegisterMarkitdown]);

  // Get all tools including internal registry
  const allTools = useMemo(() => getAllTools(notes), [notes]);

  // Load tool usage stats
  const toolUsageStats = useMemo(() => getToolUsage(), [notes]);

  const toolUsageMap = useMemo(() => {
    const map = new Map<string, { totalCalls: number; lastCalled: number | null; avgDurationMs: number }>();
    for (const stat of toolUsageStats) {
      map.set(stat.toolId, { totalCalls: stat.totalCalls, lastCalled: stat.lastCalled, avgDurationMs: stat.avgDurationMs });
    }
    return map;
  }, [toolUsageStats]);

  // Find the source note for a tool (if from vault)
  const getSourceNote = (tool: Tool): VaultNote | undefined => {
    return notes.find((note) => isToolNote(note) && loadToolMetadata(note).id === tool.id);
  };

  // Tool counts by category (across all tools)
  const toolCounts = useMemo(() => {
    return {
      all: allTools.length,
      internal: allTools.filter((t) => t.provider === 'internal').length,
      mcp: allTools.filter((t) => t.provider === 'mcp').length,
      disabled: allTools.filter((t) => t.permission === 'disabled').length,
    };
  }, [allTools]);

  // Filter by category
  const filteredByCategory = useMemo(() => {
    switch (selectedCategory) {
      case 'internal':
        return allTools.filter((t) => t.provider === 'internal');
      case 'mcp':
        return allTools.filter((t) => t.provider === 'mcp');
      case 'disabled':
        return allTools.filter((t) => t.permission === 'disabled');
      default:
        return allTools;
    }
  }, [allTools, selectedCategory]);

  // Filter by MCP server (only when category is mcp or all)
  const filteredByMcpServer = useMemo(() => {
    if (mcpServerFilter === 'all') return filteredByCategory;
    return filteredByCategory.filter((t) => t.provider === 'mcp' && t.server === mcpServerFilter);
  }, [filteredByCategory, mcpServerFilter]);

  // Filter by risk
  const filteredByRisk = useMemo(() => {
    if (riskFilter === 'all') return filteredByMcpServer;
    return filteredByMcpServer.filter((t) => t.risk === riskFilter);
  }, [filteredByMcpServer, riskFilter]);

  // Filter by search query
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return filteredByRisk;
    const query = searchQuery.toLowerCase();
    return filteredByRisk.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)),
    );
  }, [filteredByRisk, searchQuery]);

  // Sort the final filtered list
  const sortedFilteredTools = useMemo(() => {
    const list = [...filteredBySearch];
    if (sortBy === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recent') {
      list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    } else if (sortBy === 'risk') {
      const order: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };
      list.sort((a, b) => order[a.risk] - order[b.risk] || a.name.localeCompare(b.name));
    }
    return list;
  }, [filteredBySearch, sortBy]);

  // Tool stats for the strip
  const toolStats = useMemo(() => {
    const active = allTools.filter(
      (t) => t.status === 'active' && t.permission !== 'disabled',
    ).length;
    const highRisk = allTools.filter((t) => t.risk === 'high').length;
    const disabled = allTools.filter((t) => t.permission === 'disabled').length;
    const brokenMcp = allTools.filter(
      (t) => t.provider === 'mcp' && (t.status === 'error' || t.status === 'disconnected'),
    ).length;
    return { total: allTools.length, active, highRisk, disabled, brokenMcp };
  }, [allTools]);

  // Available MCP server names (for the MCP server filter)
  const availableMcpServers = useMemo(() => {
    const set = new Set<string>();
    allTools
      .filter((t) => t.provider === 'mcp' && t.server)
      .forEach((t) => {
        if (t.server) set.add(t.server);
      });
    return Array.from(set).sort();
  }, [allTools]);

  // Are any filters active?
  const hasActiveFilters = useMemo(() => {
    return (
      selectedCategory !== 'all' ||
      riskFilter !== 'all' ||
      sortBy !== 'alpha' ||
      mcpServerFilter !== 'all' ||
      searchQuery.trim() !== ''
    );
  }, [selectedCategory, riskFilter, sortBy, mcpServerFilter, searchQuery]);

  const clearFilters = () => {
    setSelectedCategory('all');
    setRiskFilter('all');
    setSortBy('alpha');
    setMcpServerFilter('all');
    setSearchQuery('');
  };

  // Initial expanded state for the Permission Grants panel
  useEffect(() => {
    setGrantsExpanded(alwaysAllowed.size > 0);
  }, [alwaysAllowed.size]);

  const handleToolClick = (tool: Tool) => {
    setSelectedTool(tool);
  };

  const handlePermissionChange = async (toolId: string, permission: ToolPermission) => {
    await onToolPermissionChange(toolId, permission);
    // Update the selected tool if it's the one being modified
    if (selectedTool && selectedTool.id === toolId) {
      setSelectedTool({ ...selectedTool, permission });
    }
  };

  const revokeAlwaysAllowed = (toolId: string) => {
    removeAlwaysAllowId(toolId);
    setAlwaysAllowed(getAlwaysAllowIds());
    setPermissionLog(getPermissionLog().slice().reverse());
  };

  const revokeAllAlwaysAllowed = () => {
    getAlwaysAllowIds().forEach((toolId) => removeAlwaysAllowId(toolId));
    setAlwaysAllowed(getAlwaysAllowIds());
    setPermissionLog(getPermissionLog().slice().reverse());
  };

  // Map toolId -> Tool for richer rows in the grants panel
  const toolById = useMemo(() => {
    const map = new Map<string, Tool>();
    for (const tool of allTools) map.set(tool.id, tool);
    return map;
  }, [allTools]);

  // Group recent grants (filtered by logFilter) into "Today" and "Earlier"
  const groupedLog = useMemo(() => {
    const filtered = permissionLog.filter((entry) => {
      if (logFilter === 'all') return true;
      if (logFilter === 'always') return entry.decision === 'always_allow';
      if (logFilter === 'session') return entry.decision === 'allow_session';
      if (logFilter === 'once') return entry.decision === 'allow_once';
      return true;
    });
    const today: typeof filtered = [];
    const earlier: typeof filtered = [];
    for (const entry of filtered) {
      if (isSameDay(entry.timestamp, Date.now())) today.push(entry);
      else earlier.push(entry);
    }
    return { today, earlier, total: filtered.length };
  }, [permissionLog, logFilter]);

  const alwaysAllowedTools = useMemo(() => {
    return [...alwaysAllowed].map((id) => toolById.get(id)).filter((t): t is Tool => Boolean(t));
  }, [alwaysAllowed, toolById]);

  const unknownAlwaysAllowedIds = useMemo(() => {
    return [...alwaysAllowed].filter((id) => !toolById.has(id));
  }, [alwaysAllowed, toolById]);

  const todayCount = useMemo(
    () => permissionLog.filter((e) => isSameDay(e.timestamp, Date.now())).length,
    [permissionLog],
  );
  const highRiskGrants = useMemo(
    () =>
      permissionLog.filter((e) => {
        const tool = toolById.get(e.toolId);
        return tool?.risk === 'high';
      }).length,
    [permissionLog, toolById],
  );

  const bridgeTitle = `Bridge: ${bridgeStatus} · Last checked ${formatTimestamp(lastCheckedAt)}`;
  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Agent capabilities</span>
          <h1>
            <Terminal size={20} /> Tools & MCP Registry
          </h1>
          <p>
            Register vault-backed tool metadata and manage permissions for agent-readable notes.
          </p>
        </div>
        <div className="page-header-actions">
          <span
            className={`bridge-status-badge ${bridgeStatus}`}
            title={bridgeTitle}
            aria-label={bridgeTitle}
          >
            <Link2 size={10} />
            Bridge: {bridgeStatus}
          </span>
          <div className="graph-toolbar" role="group" aria-label="View mode">
            <button
              type="button"
              className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List size={14} />
            </button>
          </div>
          <button className="primary-button" onClick={() => setRegisterOpen(true)}>
            <Plus size={14} /> Register MCP tool
          </button>
          {onRegisterMarkitdown && (
            <button
              className="ghost-button"
              onClick={() => void onRegisterMarkitdown()}
              title="Add the MarkItDown MCP server to the bridge and seed a tool note"
            >
              <FileText size={14} /> Register MarkItDown
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="stats-grid tools-stats" role="group" aria-label="Tool registry summary">
        <div className="stat-card">
          <div className="stat-card-icon">
            <Terminal size={14} />
          </div>
          <span>Total</span>
          <strong>{toolStats.total}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon stat-card-icon--positive">
            <CheckCircle2 size={14} />
          </div>
          <span>Active</span>
          <strong>{toolStats.active}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon stat-card-icon--warning">
            <ShieldAlert size={14} />
          </div>
          <span>High-risk</span>
          <strong>{toolStats.highRisk}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon stat-card-icon--muted">
            <ShieldOff size={14} />
          </div>
          <span>Disabled</span>
          <strong>{toolStats.disabled}</strong>
        </div>
        {toolStats.brokenMcp > 0 && (
          <div className="stat-card">
            <div className="stat-card-icon stat-card-icon--danger">
              <AlertOctagon size={14} />
            </div>
            <span>Broken MCP</span>
            <strong>{toolStats.brokenMcp}</strong>
          </div>
        )}
      </div>

      {/* Category Tabs + Risk + Sort + Search */}
      <div className="agents-filter-bar">
        <div className="agents-filter-group" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`agents-filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
            aria-pressed={selectedCategory === 'all'}
          >
            All ({toolCounts.all})
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${selectedCategory === 'internal' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('internal')}
            aria-pressed={selectedCategory === 'internal'}
          >
            Internal ({toolCounts.internal})
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${selectedCategory === 'mcp' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('mcp')}
            aria-pressed={selectedCategory === 'mcp'}
          >
            MCP Tools ({toolCounts.mcp})
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${selectedCategory === 'disabled' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('disabled')}
            aria-pressed={selectedCategory === 'disabled'}
          >
            Disabled ({toolCounts.disabled})
          </button>
        </div>

        <div className="agents-filter-group" role="group" aria-label="Filter by risk">
          <button
            type="button"
            className={`agents-filter-btn ${riskFilter === 'all' ? 'active' : ''}`}
            onClick={() => setRiskFilter('all')}
            aria-pressed={riskFilter === 'all'}
          >
            All risk
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${riskFilter === 'low' ? 'active' : ''}`}
            onClick={() => setRiskFilter('low')}
            aria-pressed={riskFilter === 'low'}
          >
            Low
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${riskFilter === 'medium' ? 'active' : ''}`}
            onClick={() => setRiskFilter('medium')}
            aria-pressed={riskFilter === 'medium'}
          >
            Medium
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${riskFilter === 'high' ? 'active' : ''}`}
            onClick={() => setRiskFilter('high')}
            aria-pressed={riskFilter === 'high'}
          >
            High
          </button>
        </div>

        <div className="agents-filter-group" role="group" aria-label="Sort tools">
          <button
            type="button"
            className={`agents-filter-btn ${sortBy === 'alpha' ? 'active' : ''}`}
            onClick={() => setSortBy('alpha')}
            aria-pressed={sortBy === 'alpha'}
          >
            A-Z
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${sortBy === 'recent' ? 'active' : ''}`}
            onClick={() => setSortBy('recent')}
            aria-pressed={sortBy === 'recent'}
          >
            Recent
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${sortBy === 'risk' ? 'active' : ''}`}
            onClick={() => setSortBy('risk')}
            aria-pressed={sortBy === 'risk'}
          >
            Risk (high→low)
          </button>
        </div>

        <div className="agents-filter-fields">
          {availableMcpServers.length > 1 &&
            (selectedCategory === 'all' || selectedCategory === 'mcp') && (
              <select
                className="agents-filter-select"
                value={mcpServerFilter}
                onChange={(e) => setMcpServerFilter(e.target.value)}
                aria-label="Filter by MCP server"
              >
                <option value="all">All MCP servers</option>
                {availableMcpServers.map((server) => (
                  <option key={server} value={server}>
                    {server}
                  </option>
                ))}
              </select>
            )}
          <label className="agents-filter-field">
            <Search size={12} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools…"
              aria-label="Search tools"
            />
          </label>
          {hasActiveFilters && (
            <button type="button" className="agents-filter-clear" onClick={clearFilters}>
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Live region for filtered count */}
      {allTools.length > 0 && (
        <p className="tools-filter-summary muted" aria-live="polite">
          Showing {sortedFilteredTools.length} of {allTools.length} tools
        </p>
      )}

      {/* Permission Grants (moved above the tool grid) */}
      <section className="panel-card tools-permission-panel">
        <button
          type="button"
          className="tools-permission-panel-header"
          onClick={() => setGrantsExpanded((v) => !v)}
          aria-expanded={grantsExpanded}
          aria-controls="tools-permission-panel-body"
        >
          <span className="tools-permission-panel-title">
            <ShieldCheck size={16} /> Permission Grants
            <span className="tools-permission-panel-count">
              {alwaysAllowed.size} always-allowed
            </span>
            {todayCount > 0 && (
              <span className="tools-permission-panel-count tools-permission-panel-count--muted">
                {todayCount} today
              </span>
            )}
          </span>
          {grantsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {grantsExpanded && (
          <div id="tools-permission-panel-body" className="tools-permission-panel-body">
            <p className="tools-permission-panel-intro muted">
              Session grants live only in the open chat session. Always-allowed tools are stored
              locally and can be revoked here.
            </p>

            <div
              className="tools-permission-stats"
              role="group"
              aria-label="Permission grant summary"
            >
              <div className="tools-permission-stat tools-permission-stat--positive">
                <span className="tools-permission-stat-icon">
                  <ShieldCheck size={14} />
                </span>
                <div className="tools-permission-stat-body">
                  <strong>{alwaysAllowed.size}</strong>
                  <span>Always allowed</span>
                </div>
              </div>
              <div className="tools-permission-stat">
                <span className="tools-permission-stat-icon">
                  <CheckCircle2 size={14} />
                </span>
                <div className="tools-permission-stat-body">
                  <strong>{todayCount}</strong>
                  <span>Grants today</span>
                </div>
              </div>
              <div
                className={`tools-permission-stat ${highRiskGrants > 0 ? 'tools-permission-stat--danger' : ''}`}
              >
                <span className="tools-permission-stat-icon">
                  <ShieldAlert size={14} />
                </span>
                <div className="tools-permission-stat-body">
                  <strong>{highRiskGrants}</strong>
                  <span>High-risk grants</span>
                </div>
              </div>
              <div className="tools-permission-stat">
                <span className="tools-permission-stat-icon">
                  <List size={14} />
                </span>
                <div className="tools-permission-stat-body">
                  <strong>{permissionLog.length}</strong>
                  <span>Total recorded</span>
                </div>
              </div>
            </div>

            <div className="tools-permission-grid">
              <div className="tools-permission-panel-section">
                <div className="tools-permission-section-head">
                  <div>
                    <h4>Always allowed</h4>
                    <p className="muted">
                      {alwaysAllowedTools.length > 0 || unknownAlwaysAllowedIds.length > 0
                        ? 'Stored locally. Revoke to require approval again.'
                        : 'No tools are skipped from the permission prompt.'}
                    </p>
                  </div>
                  {alwaysAllowed.size > 1 && (
                    <button
                      type="button"
                      className="ghost-button tools-permission-revoke-all"
                      onClick={revokeAllAlwaysAllowed}
                    >
                      <ShieldOff size={12} /> Revoke all
                    </button>
                  )}
                </div>
                {alwaysAllowedTools.length > 0 || unknownAlwaysAllowedIds.length > 0 ? (
                  <ul className="tools-permission-list" role="list">
                    {alwaysAllowedTools.map((tool) => {
                      const riskClass = getRiskColorClass(tool.risk);
                      return (
                        <li key={tool.id} className="tools-permission-item">
                          <span className="tools-permission-item-avatar" aria-hidden="true">
                            <Terminal size={14} />
                          </span>
                          <div className="tools-permission-item-body">
                            <div className="tools-permission-item-title-row">
                              <strong className="tools-permission-item-name">{tool.name}</strong>
                              <span className="tools-permission-item-id">{tool.id}</span>
                            </div>
                            <div className="tools-permission-item-badges">
                              <span
                                className={`permission-badge ${getPermissionColorClass(tool.permission)}`}
                              >
                                {getPermissionIcon(tool.permission)}
                                {formatPermission(tool.permission)}
                              </span>
                              <span className={`risk-badge ${riskClass}`}>
                                {formatRisk(tool.risk)}
                              </span>
                              {tool.provider === 'mcp' && tool.server && (
                                <span className="provider-badge">MCP: {tool.server}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="ghost-button tools-permission-revoke"
                            onClick={() => revokeAlwaysAllowed(tool.id)}
                            aria-label={`Revoke always-allow for ${tool.name}`}
                          >
                            <X size={12} /> Revoke
                          </button>
                        </li>
                      );
                    })}
                    {unknownAlwaysAllowedIds.map((toolId) => (
                      <li
                        key={toolId}
                        className="tools-permission-item tools-permission-item--unknown"
                      >
                        <span
                          className="tools-permission-item-avatar tools-permission-item-avatar--muted"
                          aria-hidden="true"
                        >
                          <ShieldOff size={14} />
                        </span>
                        <div className="tools-permission-item-body">
                          <div className="tools-permission-item-title-row">
                            <strong className="tools-permission-item-name">
                              Unregistered tool
                            </strong>
                            <span className="tools-permission-item-id">{toolId}</span>
                          </div>
                          <p className="muted tools-permission-item-meta">
                            No matching tool note. The grant remains in storage until revoked.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="ghost-button tools-permission-revoke"
                          onClick={() => revokeAlwaysAllowed(toolId)}
                          aria-label={`Revoke always-allow for ${toolId}`}
                        >
                          <X size={12} /> Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="tools-permission-empty">
                    <span className="tools-permission-empty-icon" aria-hidden="true">
                      <ShieldCheck size={18} />
                    </span>
                    <div>
                      <strong>No standing grants</strong>
                      <p className="muted">
                        Tools that need approval will always prompt the agent. Approve with “Always
                        allow” to skip the prompt for a specific tool.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="tools-permission-panel-section">
                <div className="tools-permission-section-head">
                  <div>
                    <h4>Recent activity</h4>
                    <p className="muted">
                      Newest first. Up to 200 entries are kept in local storage.
                    </p>
                  </div>
                  {permissionLog.length > 0 && (
                    <div
                      className="tools-permission-filter"
                      role="group"
                      aria-label="Filter recent activity"
                    >
                      <button
                        type="button"
                        className={`agents-filter-btn ${logFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setLogFilter('all')}
                        aria-pressed={logFilter === 'all'}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`agents-filter-btn ${logFilter === 'always' ? 'active' : ''}`}
                        onClick={() => setLogFilter('always')}
                        aria-pressed={logFilter === 'always'}
                      >
                        Always
                      </button>
                      <button
                        type="button"
                        className={`agents-filter-btn ${logFilter === 'session' ? 'active' : ''}`}
                        onClick={() => setLogFilter('session')}
                        aria-pressed={logFilter === 'session'}
                      >
                        Session
                      </button>
                      <button
                        type="button"
                        className={`agents-filter-btn ${logFilter === 'once' ? 'active' : ''}`}
                        onClick={() => setLogFilter('once')}
                        aria-pressed={logFilter === 'once'}
                      >
                        Once
                      </button>
                    </div>
                  )}
                </div>
                {groupedLog.total > 0 ? (
                  <div className="tools-permission-activity">
                    {groupedLog.today.length > 0 && (
                      <div className="tools-permission-activity-group">
                        <span className="tools-permission-activity-day">Today</span>
                        <ul
                          className="tools-permission-list tools-permission-list--compact"
                          role="list"
                        >
                          {groupedLog.today.slice(0, 6).map((entry) => {
                            const tool = toolById.get(entry.toolId);
                            const meta = DECISION_META[entry.decision];
                            const Icon = meta.icon;
                            return (
                              <li
                                key={`${entry.timestamp}-${entry.toolId}-${entry.decision}`}
                                className="tools-permission-activity-item"
                              >
                                <span
                                  className={`tools-permission-decision tools-permission-decision--${meta.tone}`}
                                >
                                  <Icon size={11} />
                                  {meta.shortLabel}
                                </span>
                                <div className="tools-permission-activity-body">
                                  <strong>{entry.toolName}</strong>
                                  {tool?.provider === 'mcp' && tool.server && (
                                    <span className="muted"> · {tool.server}</span>
                                  )}
                                </div>
                                <time
                                  className="tools-permission-activity-time"
                                  dateTime={new Date(entry.timestamp).toISOString()}
                                  title={new Date(entry.timestamp).toLocaleString()}
                                >
                                  {formatRelativeTime(entry.timestamp)}
                                </time>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {groupedLog.earlier.length > 0 && (
                      <div className="tools-permission-activity-group">
                        <span className="tools-permission-activity-day">Earlier</span>
                        <ul
                          className="tools-permission-list tools-permission-list--compact"
                          role="list"
                        >
                          {groupedLog.earlier.slice(0, 4).map((entry) => {
                            const tool = toolById.get(entry.toolId);
                            const meta = DECISION_META[entry.decision];
                            const Icon = meta.icon;
                            return (
                              <li
                                key={`${entry.timestamp}-${entry.toolId}-${entry.decision}`}
                                className="tools-permission-activity-item"
                              >
                                <span
                                  className={`tools-permission-decision tools-permission-decision--${meta.tone}`}
                                >
                                  <Icon size={11} />
                                  {meta.shortLabel}
                                </span>
                                <div className="tools-permission-activity-body">
                                  <strong>{entry.toolName}</strong>
                                  {tool?.provider === 'mcp' && tool.server && (
                                    <span className="muted"> · {tool.server}</span>
                                  )}
                                </div>
                                <time
                                  className="tools-permission-activity-time"
                                  dateTime={new Date(entry.timestamp).toISOString()}
                                  title={new Date(entry.timestamp).toLocaleString()}
                                >
                                  {formatRelativeTime(entry.timestamp)}
                                </time>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="tools-permission-empty">
                    <span className="tools-permission-empty-icon" aria-hidden="true">
                      <List size={18} />
                    </span>
                    <div>
                      <strong>
                        {permissionLog.length === 0
                          ? 'No activity yet'
                          : 'No activity matches this filter'}
                      </strong>
                      <p className="muted">
                        Permission decisions from the chat loop will appear here for quick review.
                      </p>
                    </div>
                  </div>
                )}
                {groupedLog.total > 6 && (
                  <p className="tools-permission-activity-foot muted">
                    Showing the 6 most recent entries in each window. {groupedLog.total} match this
                    filter.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tool Cards Grid (or List) */}
      {sortedFilteredTools.length ? (
        <div className={viewMode === 'grid' ? 'agent-rich-grid' : 'note-list-cards'}>
          {sortedFilteredTools.map((tool) =>
            viewMode === 'grid' ? (
              <ToolCard
                key={tool.id}
                tool={tool}
                onClick={() => handleToolClick(tool)}
                onSelectNote={onSelectNote}
                sourceNote={getSourceNote(tool)}
                toolUsage={toolUsageMap.get(tool.id)}
              />
            ) : (
              <ToolListCard
                key={tool.id}
                tool={tool}
                onClick={() => handleToolClick(tool)}
                onSelectNote={onSelectNote}
                sourceNote={getSourceNote(tool)}
                toolUsage={toolUsageMap.get(tool.id)}
              />
            ),
          )}
        </div>
      ) : allTools.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Terminal size={24} />
          </div>
          <h2>No tools registered</h2>
          <p>
            Register an MCP tool note or add markdown under <code>Tools/</code> with{' '}
            <code>type: tool</code>.
          </p>
          <div className="empty-action">
            <button className="primary-button" onClick={() => setRegisterOpen(true)}>
              <Plus size={14} /> Register MCP tool
            </button>
            {onRegisterMarkitdown && (
              <button
                className="ghost-button"
                onClick={() => void onRegisterMarkitdown()}
                style={{ marginLeft: 'var(--space-2)' }}
              >
                <FileText size={14} /> Register MarkItDown
              </button>
            )}
          </div>
          <p className="muted" style={{ marginTop: 'var(--space-3)' }}>
            MarkItDown converts PDF, Word, Excel, PowerPoint, Outlook, HTML, CSV, JSON, XML, EPub,
            and ZIP files to Markdown.
          </p>
          <pre className="empty-state-snippet">{STARTER_TOOL_YAML}</pre>
        </div>
      ) : (
        <div className="panel-card">
          <h3>
            <X size={16} /> No tools match these filters
          </h3>
          <p>Try adjusting your search, category, risk, or sort selection.</p>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <button className="ghost-button" onClick={clearFilters}>
              <X size={12} /> Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Tool Detail Drawer */}
      {selectedTool && (
        <ToolDetailDrawer
          tool={selectedTool}
          notes={notes}
          onClose={() => setSelectedTool(null)}
          onSelectNote={onSelectNote}
          onPermissionChange={(permission) => handlePermissionChange(selectedTool.id, permission)}
          sourceNote={getSourceNote(selectedTool)}
          onMarkitdownConvert={onMarkitdownConvert}
          toolUsage={toolUsageMap.get(selectedTool.id)}
        />
      )}

      {registerOpen && (
        <RegisterMcpToolModal
          onClose={() => setRegisterOpen(false)}
          onSubmit={async (tool) => {
            await onRegisterMcpTool(tool);
            setRegisterOpen(false);
          }}
        />
      )}
    </main>
  );
}

interface ToolCardProps {
  tool: Tool;
  onClick: () => void;
  onSelectNote: (key: string) => void;
  sourceNote?: VaultNote;
  toolUsage?: { totalCalls: number; lastCalled: number | null; avgDurationMs: number };
}

function ToolCard({ tool, onClick, onSelectNote, sourceNote, toolUsage }: ToolCardProps) {
  const riskClass = getRiskColorClass(tool.risk);
  const cardClasses = [
    'agent-rich-card',
    'tool-card',
    `tool-card--risk-${tool.risk}`,
    tool.permission === 'disabled' ? 'tool-card--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const roleLine =
    tool.provider === 'mcp' && tool.server ? `${tool.id} · MCP: ${tool.server}` : tool.id;
  const riskTitle = formatRisk(tool.risk);

  return (
    <article
      className={cardClasses}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      title={riskTitle}
    >
      <div className="agent-card-header">
        <div className="agent-avatar large" title={riskTitle}>
          <Terminal size={24} />
        </div>
        <div className="agent-identity">
          <h3>{tool.name}</h3>
          <p className="agent-role">{roleLine}</p>
          <span className={`agent-status ${tool.status}`}>
            {getStatusIcon(tool.status)}
            {tool.status}
          </span>
        </div>
        <div className="agent-actions">
          {sourceNote && (
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectNote(getNoteKey(sourceNote));
              }}
              title="Open source note"
              aria-label="Open source note"
            >
              <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="agent-card-body">
        {tool.description && <p className="agent-description">{tool.description}</p>}

        <div className="tool-meta-badges">
          <span className={`permission-badge permission-${tool.permission}`}>
            {getPermissionIcon(tool.permission)}
            {formatPermission(tool.permission)}
          </span>
          <span className={`risk-badge ${riskClass}`}>{formatRisk(tool.risk)}</span>
          <span className="provider-badge">
            {tool.provider === 'mcp' ? `MCP: ${tool.server || 'unknown'}` : 'Internal'}
          </span>
          <span className="provider-badge">
            {tool.source === 'system' ? 'System tool' : 'Vault note'}
          </span>
        </div>
      </div>

      <div className="agent-card-footer">
        <span>{tool.source === 'system' ? 'system' : tool.provider}</span>
        {tool.updatedAt && <span>Updated {new Date(tool.updatedAt).toLocaleDateString()}</span>}
        {toolUsage && toolUsage.totalCalls > 0 && (
          <span title={`Avg: ${Math.round(toolUsage.avgDurationMs)}ms`}>
            <Clock size={10} /> {toolUsage.totalCalls} calls
          </span>
        )}
        {toolUsage && toolUsage.lastCalled && (
          <span>
            <Clock size={10} /> {new Date(toolUsage.lastCalled).toLocaleDateString()}
          </span>
        )}
      </div>
    </article>
  );
}

interface ToolListCardProps {
  tool: Tool;
  onClick: () => void;
  onSelectNote: (key: string) => void;
  sourceNote?: VaultNote;
  toolUsage?: { totalCalls: number; lastCalled: number | null; avgDurationMs: number };
}

function ToolListCard({ tool, onClick, onSelectNote, sourceNote, toolUsage }: ToolListCardProps) {
  const riskClass = getRiskColorClass(tool.risk);
  const cardClasses = [
    'panel-card',
    'tool-list-card',
    `tool-card--risk-${tool.risk}`,
    tool.permission === 'disabled' ? 'tool-card--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const riskTitle = formatRisk(tool.risk);
  const roleLine =
    tool.provider === 'mcp' && tool.server ? `${tool.id} · MCP: ${tool.server}` : tool.id;

  return (
    <article
      className={cardClasses}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      title={riskTitle}
    >
      <div className="tool-list-card-header">
        <div className="agent-avatar large" title={riskTitle}>
          <Terminal size={20} />
        </div>
        <div className="agent-identity">
          <h3>{tool.name}</h3>
          <p className="agent-role">{roleLine}</p>
          <span className={`agent-status ${tool.status}`}>
            {getStatusIcon(tool.status)}
            {tool.status}
          </span>
        </div>
        <div className="agent-actions">
          {sourceNote && (
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectNote(getNoteKey(sourceNote));
              }}
              title="Open source note"
              aria-label="Open source note"
            >
              <ExternalLink size={14} />
            </button>
          )}
          <ChevronRight size={14} className="tool-list-card-chevron" />
        </div>
      </div>
      <div className="tool-meta-badges">
        <span className={`permission-badge permission-${tool.permission}`}>
          {getPermissionIcon(tool.permission)}
          {formatPermission(tool.permission)}
        </span>
        <span className={`risk-badge ${riskClass}`}>{formatRisk(tool.risk)}</span>
        <span className="provider-badge">
          {tool.provider === 'mcp' ? `MCP: ${tool.server || 'unknown'}` : 'Internal'}
        </span>
        <span className="provider-badge">
          {tool.source === 'system' ? 'System tool' : 'Vault note'}
        </span>
      </div>
    </article>
  );
}

interface ToolDetailDrawerProps {
  tool: Tool;
  notes: VaultNote[];
  onClose: () => void;
  onSelectNote: (key: string) => void;
  onPermissionChange: (permission: ToolPermission) => void;
  sourceNote?: VaultNote;
  onMarkitdownConvert?: (request: {
    uri: string;
    fileType?: string;
    suggestedTitle?: string;
  }) => Promise<{ success: boolean; error?: string; path?: string }>;
  toolUsage?: { totalCalls: number; lastCalled: number | null; avgDurationMs: number };
}

function ToolDetailDrawer({
  tool,
  notes,
  onClose,
  onSelectNote,
  onPermissionChange,
  sourceNote,
  onMarkitdownConvert,
  toolUsage,
}: ToolDetailDrawerProps) {
  const drawerBridgeStatus = getCachedBridgeStatus();
  const relatedAgents = useMemo(() => getRelatedAgentsForTool(tool, notes), [tool, notes]);
  const relatedSkills = useMemo(() => getRelatedSkillsForTool(tool, notes), [tool, notes]);

  const otherFrontmatter = sourceNote
    ? Object.entries(sourceNote.frontmatter).filter(
        ([k]) =>
          ![
            'type',
            'name',
            'tool_id',
            'provider',
            'status',
            'permission',
            'risk',
            'description',
          ].includes(k),
      )
    : [];
  const canEditPermission =
    tool.source === 'system' ||
    Boolean(sourceNote && sourceNote.vaultRole === 'personal' && !sourceNote.readOnly);

  return (
    <>
      <div className="detail-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="detail-drawer" role="dialog" aria-label={`${tool.name} details`}>
        <div className="detail-drawer-header">
          <div>
            <h3>{tool.name}</h3>
            <p className="detail-drawer-role">{tool.id}</p>
          </div>
          <button className="detail-drawer-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="detail-drawer-body">
          {tool.description && <p className="detail-drawer-description">{tool.description}</p>}

          {/* Permission Control */}
          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Permission</span>
            <select
              className="permission-select"
              value={tool.permission}
              disabled={!canEditPermission}
              onChange={(e) => onPermissionChange(e.target.value as ToolPermission)}
            >
              {PERMISSION_OPTIONS.map((perm) => (
                <option key={perm} value={perm}>
                  {formatPermission(perm)}
                </option>
              ))}
            </select>
            {!canEditPermission && <span className="muted">Read-only metadata</span>}
            {tool.source === 'system' && (
              <span className="muted">Stored as a local app override for this browser.</span>
            )}
          </div>

          {/* Status & Risk */}
          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Status</span>
            <span className={`detail-drawer-field-value status-${tool.status}`}>
              {getStatusIcon(tool.status)}
              {tool.status}
            </span>
          </div>

          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Risk</span>
            <span className={`detail-drawer-field-value ${getRiskColorClass(tool.risk)}`}>
              {formatRisk(tool.risk)}
            </span>
          </div>

          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Provider</span>
            <span className="detail-drawer-field-value">
              {tool.provider === 'mcp' ? `MCP Server: ${tool.server || 'unknown'}` : 'Internal'} ·{' '}
              {tool.source === 'system' ? 'System' : 'Vault note'}
            </span>
          </div>

          {toolUsage && toolUsage.totalCalls > 0 && (
            <>
              <div className="detail-drawer-field">
                <span className="detail-drawer-field-label">Total Calls</span>
                <span className="detail-drawer-field-value">{toolUsage.totalCalls}</span>
              </div>
              <div className="detail-drawer-field">
                <span className="detail-drawer-field-label">Avg Duration</span>
                <span className="detail-drawer-field-value">{Math.round(toolUsage.avgDurationMs)}ms</span>
              </div>
              {toolUsage.lastCalled && (
                <div className="detail-drawer-field">
                  <span className="detail-drawer-field-label">Last Called</span>
                  <span className="detail-drawer-field-value">
                    {new Date(toolUsage.lastCalled).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}

          {/* MCP Servers Section */}
          {tool.provider === 'mcp' && (
            <div className="detail-drawer-section">
              <h4>MCP Server</h4>
              <p className="muted">
                MCP tools execute through the Node sidecar, which can spawn local commands. The
                development bridge currently uses broad CORS; only run servers you trust.{' '}
                {drawerBridgeStatus === 'connected'
                  ? 'Bridge connected.'
                  : 'Start the bridge with npm run bridge:dev.'}
              </p>
            </div>
          )}

          {/* MarkItDown-specific actions */}
          {tool.id === 'markitdown.convert' && (
            <MarkitdownConvertPanel tool={tool} onConvert={onMarkitdownConvert} onClose={onClose} />
          )}

          {tool.id === 'markitdown.install_extras' && <MarkitdownInstallExtrasPanel tool={tool} />}

          {tool.id === 'markitdown.list_capabilities' && (
            <MarkitdownCapabilitiesPanel tool={tool} />
          )}

          {tool.installHint && (
            <div className="detail-drawer-section">
              <h4>Install</h4>
              <pre className="schema-block">{tool.installHint}</pre>
              {tool.capabilitiesUrl && (
                <p className="muted">
                  <a href={tool.capabilitiesUrl} target="_blank" rel="noreferrer">
                    Supported formats
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Input/Output Schemas (placeholder) */}
          {tool.inputSchema && (
            <div className="detail-drawer-section">
              <h4>Input Schema</h4>
              <pre className="schema-block">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
            </div>
          )}

          {tool.outputSchema && (
            <div className="detail-drawer-section">
              <h4>Output Schema</h4>
              <pre className="schema-block">{JSON.stringify(tool.outputSchema, null, 2)}</pre>
            </div>
          )}

          {/* Usage Examples (from source note content) */}
          {sourceNote && (
            <div className="detail-drawer-section">
              <h4>Documentation</h4>
              <div className="tool-doc-content">
                {sourceNote.content
                  .split('\n')
                  .slice(5)
                  .map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
              </div>
            </div>
          )}

          {/* Related Skills */}
          {relatedSkills.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Related Skills ({relatedSkills.length})</h4>
              <div className="detail-drawer-links">
                {relatedSkills.map((skill) => (
                  <button
                    key={getNoteKey(skill)}
                    className="link-pill"
                    onClick={() => onSelectNote(getNoteKey(skill))}
                  >
                    <ChevronRight size={11} />
                    {skill.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Related Agents */}
          {relatedAgents.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Related Agents ({relatedAgents.length})</h4>
              <div className="detail-drawer-links">
                {relatedAgents.map((agent) => (
                  <button
                    key={getNoteKey(agent)}
                    className="backlink-card"
                    onClick={() => onSelectNote(getNoteKey(agent))}
                  >
                    <strong>{agent.title}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Other Frontmatter */}
          {otherFrontmatter.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Metadata</h4>
              {otherFrontmatter.map(([key, value]) => (
                <div key={key} className="detail-drawer-field">
                  <span className="detail-drawer-field-label">{key}</span>
                  <span className="detail-drawer-field-value">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Source Path */}
          {sourceNote && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Source note</span>
              <code className="detail-drawer-path">{sourceNote.path}</code>
            </div>
          )}

          <div className="detail-drawer-section">
            <h4>Execution</h4>
            {tool.provider === 'internal' ? (
              <p className="muted">
                Internal tools run in the browser. The agent chat loop uses them automatically when
                tools are enabled.
              </p>
            ) : drawerBridgeStatus === 'connected' ? (
              <p className="muted">Bridge connected — MCP tools can execute via the sidecar.</p>
            ) : (
              <p className="muted">
                Bridge not connected. Start with <code>npm run bridge:dev</code> to enable MCP tool
                execution. Internal tools still work in-browser.
              </p>
            )}
          </div>
        </div>

        <div className="detail-drawer-footer">
          <button className="primary-button" disabled title="Registered metadata only">
            <Terminal size={13} /> Registered metadata
          </button>
          {sourceNote && (
            <button className="ghost-button" onClick={() => onSelectNote(getNoteKey(sourceNote))}>
              <ExternalLink size={13} /> Open Note
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

interface RegisterMcpToolModalProps {
  onClose: () => void;
  onSubmit: (tool: {
    server: string;
    name: string;
    toolId: string;
    description: string;
    permission: ToolPermission;
    risk: 'low' | 'medium' | 'high';
  }) => void | Promise<void>;
}

function RegisterMcpToolModal({ onClose, onSubmit }: RegisterMcpToolModalProps) {
  const [server, setServer] = useState('');
  const [name, setName] = useState('');
  const [toolId, setToolId] = useState('');
  const [description, setDescription] = useState('');
  const [permission, setPermission] = useState<ToolPermission>('ask');
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');

  const canSubmit = server.trim() && name.trim() && toolId.trim() && description.trim();

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      server: server.trim(),
      name: name.trim(),
      toolId: toolId.trim(),
      description: description.trim(),
      permission,
      risk,
    });
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-container" role="dialog" aria-label="Register MCP tool">
        <div className="modal-header">
          <h3>
            <Terminal size={16} /> Register MCP Tool
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-field-label">Server name</label>
            <input
              className="modal-input"
              value={server}
              onChange={(event) => setServer(event.target.value)}
              placeholder="filesystem"
            />
          </div>
          <div className="modal-field">
            <label className="modal-field-label">Tool name</label>
            <input
              className="modal-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Read File"
            />
          </div>
          <div className="modal-field">
            <label className="modal-field-label">Tool ID</label>
            <input
              className="modal-input"
              value={toolId}
              onChange={(event) => setToolId(event.target.value)}
              placeholder="filesystem.read_file"
            />
          </div>
          <div className="modal-field">
            <label className="modal-field-label">Description</label>
            <textarea
              className="modal-textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>
          <div className="modal-field-grid">
            <div className="modal-field">
              <label className="modal-field-label">Permission default</label>
              <select
                className="modal-select"
                value={permission}
                onChange={(event) => setPermission(event.target.value as ToolPermission)}
              >
                {PERMISSION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatPermission(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-field-label">Risk</label>
              <select
                className="modal-select"
                value={risk}
                onChange={(event) => setRisk(event.target.value as 'low' | 'medium' | 'high')}
              >
                {RISK_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatRisk(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="muted">
            This creates a personal vault note under <code>Tools/MCP/</code>. No MCP connection
            state is stored.
          </p>
        </div>

        <div className="modal-footer">
          <button className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={submit} disabled={!canSubmit}>
            <CheckCircle2 size={13} /> Register
          </button>
        </div>
      </div>
    </>
  );
}

interface MarkitdownConvertPanelProps {
  tool: Tool;
  onConvert?: (request: {
    uri: string;
    fileType?: string;
    suggestedTitle?: string;
  }) => Promise<{ success: boolean; error?: string; path?: string }>;
  onClose: () => void;
}

function MarkitdownConvertPanel({ tool, onConvert, onClose }: MarkitdownConvertPanelProps) {
  const fileInputRef = useMemo<{ current: HTMLInputElement | null }>(() => ({ current: null }), []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    tone: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const handleFile = useCallback(
    async (file: File) => {
      if (!onConvert) {
        setStatus({
          tone: 'error',
          message: 'Conversion is unavailable. Open a personal vault first.',
        });
        return;
      }
      setBusy(true);
      setStatus(null);
      try {
        const result = await onConvert({
          uri: file.name,
          fileType: file.name.split('.').pop()?.toLowerCase(),
          suggestedTitle: file.name.replace(/\.[^.]+$/, ''),
        });
        if (result.success) {
          setStatus({ tone: 'success', message: `Saved to ${result.path}` });
          onClose();
        } else {
          setStatus({ tone: 'error', message: result.error ?? 'Conversion failed.' });
        }
      } finally {
        setBusy(false);
      }
    },
    [onConvert, onClose],
  );

  const onPick = useCallback(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }, [fileInputRef]);

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const submitUrl = useCallback(async () => {
    if (!onConvert || !urlInput.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await onConvert({
        uri: urlInput.trim(),
        fileType: undefined,
        suggestedTitle: undefined,
      });
      if (result.success) {
        setStatus({ tone: 'success', message: `Saved to ${result.path}` });
        onClose();
      } else {
        setStatus({ tone: 'error', message: result.error ?? 'Conversion failed.' });
      }
    } finally {
      setBusy(false);
    }
  }, [onConvert, onClose, urlInput]);

  return (
    <div className="detail-drawer-section">
      <h4>
        <FileText size={14} /> Convert with MarkItDown
      </h4>
      <p className="muted">
        {tool.description ||
          'Convert a local file or approved HTTP(S) URL to Markdown and save it next to the source.'}
      </p>
      <input
        ref={(node) => {
          fileInputRef.current = node;
        }}
        type="file"
        accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.html,.htm,.csv,.json,.xml,.epub,.zip,.txt,.md,.rtf,.eml,.msg"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          marginTop: 'var(--space-2)',
        }}
      >
        <button
          type="button"
          className="primary-button"
          onClick={onPick}
          disabled={busy || !onConvert}
        >
          <Plus size={13} /> {busy ? 'Converting…' : 'Convert file…'}
        </button>
      </div>
      <div className="detail-drawer-field" style={{ marginTop: 'var(--space-3)' }}>
        <span className="detail-drawer-field-label">Or paste a URL</span>
        <input
          className="modal-input"
          value={urlInput}
          onChange={(event) => setUrlInput(event.target.value)}
          placeholder="https://example.com/report.pdf"
          disabled={busy}
        />
        <button
          type="button"
          className="ghost-button"
          onClick={submitUrl}
          disabled={busy || !urlInput.trim() || !onConvert}
          style={{ marginTop: 'var(--space-2)' }}
        >
          <FileText size={12} /> Convert URL
        </button>
      </div>
      {status && (
        <p className={status.tone === 'error' ? 'detail-drawer-error' : 'detail-drawer-success'}>
          {status.message}
        </p>
      )}
    </div>
  );
}

function MarkitdownInstallExtrasPanel({ tool }: { tool: Tool }) {
  const [group, setGroup] = useState('ocr');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    tone: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);

  const submit = useCallback(async () => {
    const ok = window.confirm(
      `About to run \`pip install markitdown[${group}]\` on this machine. Continue?`,
    );
    if (!ok) return;
    setBusy(true);
    setResult(null);
    try {
      const start = performance.now();
      const invocation = await invokeBridgeTool('markitdown', 'markitdown.install_extras', {
        group,
        confirm: true,
      });
      const elapsed = Math.round(performance.now() - start);
      if (invocation.success) {
        setResult({ tone: 'success', message: `pip install finished in ${elapsed}ms.` });
      } else {
        setResult({ tone: 'error', message: invocation.error ?? 'pip install failed.' });
      }
    } finally {
      setBusy(false);
    }
  }, [group]);

  return (
    <div className="detail-drawer-section">
      <h4>Install MarkItDown extras</h4>
      <p className="muted">{tool.description}</p>
      <div className="detail-drawer-field">
        <span className="detail-drawer-field-label">Extras group</span>
        <select
          className="permission-select"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          disabled={busy}
        >
          {[
            'ocr',
            'audio-transcription',
            'youtube-transcription',
            'az-doc-intel',
            'az-content-understanding',
          ].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="primary-button"
          onClick={submit}
          disabled={busy}
          style={{ marginTop: 'var(--space-2)' }}
        >
          <Terminal size={12} /> {busy ? 'Installing…' : 'Run pip install'}
        </button>
      </div>
      {result && (
        <p className={result.tone === 'error' ? 'detail-drawer-error' : 'detail-drawer-success'}>
          {result.message}
        </p>
      )}
    </div>
  );
}

function MarkitdownCapabilitiesPanel({ tool }: { tool: Tool }) {
  const [capabilities, setCapabilities] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = performance.now();
      const invocation = await invokeBridgeTool('markitdown', 'markitdown.list_capabilities', {});
      if (!invocation.success) {
        setError(invocation.error ?? 'Could not load capabilities.');
        return;
      }
      const raw = invocation.output;
      let parsed: { groups?: Record<string, boolean> } = {};
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          parsed = {};
        }
      } else if (raw && typeof raw === 'object') {
        const content = (raw as { content?: Array<{ type: string; text?: string }> }).content;
        if (Array.isArray(content)) {
          const text = content
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('\n');
          try {
            parsed = JSON.parse(text) as typeof parsed;
          } catch {
            parsed = {};
          }
        } else {
          parsed = raw as typeof parsed;
        }
      }
      setCapabilities(parsed.groups ?? {});
      void start;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="detail-drawer-section">
      <h4>MarkItDown capabilities</h4>
      <p className="muted">{tool.description}</p>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="detail-drawer-error">{error}</p>}
      {capabilities && (
        <ul className="tools-permission-list" role="list">
          {Object.entries(capabilities).map(([name, installed]) => (
            <li key={name} className="tools-permission-item">
              <span className="tools-permission-item-avatar" aria-hidden="true">
                {installed ? (
                  <CheckCircle2 size={14} className="status-active" />
                ) : (
                  <X size={14} className="status-inactive" />
                )}
              </span>
              <div className="tools-permission-item-body">
                <strong>{name}</strong>
                <span className="muted">{installed ? 'Installed' : 'Not installed'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="ghost-button"
        onClick={load}
        disabled={loading}
        style={{ marginTop: 'var(--space-2)' }}
      >
        Refresh
      </button>
    </div>
  );
}
