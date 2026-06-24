/**
 * ExcalidrawEditor – full Excalidraw editor for creating and editing diagrams.
 *
 * Wraps the `<Excalidraw>` component with a "Save to note" button that
 * serializes the scene back to JSON for embedding in a markdown code block.
 *
 * Props:
 * - `initialScene`: optional JSON scene data to load
 * - `onSave`: callback invoked with the serialized JSON string
 * - `onClose`: callback to close/dismiss the editor
 * - `theme`: 'dark' | 'light' to match the app theme
 */

import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
import { Save, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface ExcalidrawEditorProps {
  initialScene?: string | null;
  onSave: (json: string) => void;
  onClose: () => void;
  theme: 'dark' | 'light';
}

interface ExcalidrawAPI {
  getSceneElements: () => readonly Record<string, unknown>[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
}

export function ExcalidrawEditor({
  initialScene,
  onSave,
  onClose,
  theme,
}: ExcalidrawEditorProps) {
  const excalidrawRef = useRef<ExcalidrawAPI | null>(null);
  const [saving, setSaving] = useState(false);

  // Parse the initial scene data if provided
  let initialData: Record<string, unknown> | undefined;
  if (initialScene) {
    try {
      const parsed = JSON.parse(initialScene) as Record<string, unknown>;
      initialData = {
        elements: parsed.elements ?? [],
        appState: parsed.appState ?? {},
        scrollToContent: true,
      };
    } catch {
      initialData = { elements: [], scrollToContent: true };
    }
  } else {
    initialData = { elements: [], scrollToContent: true };
  }

  const handleSave = useCallback(() => {
    const api = excalidrawRef.current;
    if (!api) return;

    setSaving(true);

    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();

      // Serialize the scene to JSON
      const json = serializeAsJSON(
        elements as never,
        appState as never,
        files as never,
        'local',
      );
      onSave(json);
    } catch (err) {
      console.error('Failed to save Excalidraw scene:', err);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleApi = useCallback((api: ExcalidrawAPI) => {
    excalidrawRef.current = api;
  }, []);

  return (
    <div className="excalidraw-editor-wrapper">
      <div className="excalidraw-editor-toolbar">
        <span className="excalidraw-editor-title">Excalidraw Editor</span>
        <div className="excalidraw-editor-actions">
          <button
            type="button"
            className="primary-button excalidraw-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save to note'}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close Excalidraw editor"
            title="Close editor"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="excalidraw-editor-canvas">
        <Excalidraw
          excalidrawAPI={handleApi}
          initialData={initialData}
          theme={theme}
          viewModeEnabled={false}
          autoFocus={true}
        />
      </div>
    </div>
  );
}
