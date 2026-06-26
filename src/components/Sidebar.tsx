import {
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  Tags,
  Users,
  CheckSquare,
  PanelLeft,
  PanelLeftClose,
  Map,
  Rocket,
  Info,
  FileText,
  Bot,
  Brain,
  Terminal,
  Zap,
  GitFork,
  Edit,
} from 'lucide-react';
import type { ViewMode } from '../types';

interface SidebarProps {
  view: ViewMode;
  onChangeView: (view: ViewMode) => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  onToggleFileTree?: () => void;
  fileTreeVisible?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItemDef {
  view: ViewMode;
  label: string;
  icon: typeof Home;
}

interface NavGroup {
  label: string;
  items: NavItemDef[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { view: 'editor', label: 'Workspaces', icon: Edit },
      { view: 'dashboard', label: 'Dashboard', icon: Home },
      { view: 'graph', label: 'Graph', icon: GitFork },
      { view: 'tasks', label: 'Tasks', icon: CheckSquare },
      { view: 'tags', label: 'Tags', icon: Tags },
    ],
  },
  {
    label: 'Agents',
    items: [
      { view: 'agents', label: 'Agents', icon: Users },
      { view: 'context', label: 'Context', icon: FileText },
      { view: 'skills', label: 'Skills', icon: Zap },
      { view: 'memory', label: 'Memory', icon: Brain },
      { view: 'tools', label: 'Tools', icon: Terminal },
      { view: 'agent-runs', label: 'Runs', icon: Bot },
    ],
  },
  {
    label: 'Product',
    items: [
      { view: 'docs', label: 'Docs', icon: FileText },
      { view: 'roadmap', label: 'Roadmap', icon: Map },
      { view: 'release', label: 'Release', icon: Rocket },
      { view: 'about', label: 'About', icon: Info },
      { view: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar({
  view,
  onChangeView,
  minimized = false,
  onToggleMinimize,
  onToggleFileTree,
  fileTreeVisible = true,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        className={`sidebar${minimized ? ' sidebar-minimized' : ''}${mobileOpen ? ' sidebar-open-mobile' : ''}`}
        aria-label="Navigation sidebar"
      >
        <div className="sidebar-header">
          <nav
            className={`main-nav${minimized ? ' nav-minimized' : ''}`}
            aria-label="Main navigation"
          >
            {navGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                {!minimized && <div className="nav-group-label">{group.label}</div>}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.view}
                      className={view === item.view ? 'active' : ''}
                      onClick={() => onChangeView(item.view)}
                      title={minimized ? `${group.label}: ${item.label}` : undefined}
                    >
                      <Icon size={13} aria-hidden="true" />
                      {!minimized && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer-actions">
          <button
            className="icon-btn sidebar-toggle-btn"
            onClick={onToggleMinimize}
            title={minimized ? 'Expand sidebar' : 'Minimize sidebar'}
            aria-label={minimized ? 'Expand sidebar' : 'Minimize sidebar'}
          >
            {minimized ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <button
            className={`icon-btn sidebar-toggle-btn${!fileTreeVisible ? ' active' : ''}`}
            onClick={onToggleFileTree}
            title={fileTreeVisible ? 'Hide file tree' : 'Show file tree'}
            aria-label={fileTreeVisible ? 'Hide file tree' : 'Show file tree'}
          >
            {fileTreeVisible ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
          </button>
        </div>
      </aside>
    </>
  );
}
