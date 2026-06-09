import { useCallback, useEffect, useRef } from 'react';

export type ViewMode = '2d' | '3d';

export interface GraphCameraHandle {
  zoomToFit: (duration?: number, padding?: number) => void;
  setAutoRotate: (enabled: boolean) => void;
  resetView: () => void;
  toggleViewMode: () => void;
}

export function useGraphCamera(
  graphRef: React.MutableRefObject<any>,
  viewMode: ViewMode,
  onViewModeChange: (mode: ViewMode) => void,
): GraphCameraHandle {
  const autoRotateRef = useRef<number | null>(null);
  const autoRotateEnabledRef = useRef(false);
  const lastTimestampRef = useRef(0);

  const stopAutoRotate = useCallback(() => {
    autoRotateEnabledRef.current = false;
    if (autoRotateRef.current !== null) {
      cancelAnimationFrame(autoRotateRef.current);
      autoRotateRef.current = null;
    }
    lastTimestampRef.current = 0;
  }, []);

  const startAutoRotate = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    autoRotateEnabledRef.current = true;
    lastTimestampRef.current = 0;

    const tick = (timestamp: number) => {
      if (!autoRotateEnabledRef.current) return;
      const delta = lastTimestampRef.current ? timestamp - lastTimestampRef.current : 16;
      lastTimestampRef.current = timestamp;
      const speed = 0.0006 * delta;
      const fg = graphRef.current;
      if (fg && typeof fg.cameraPosition === 'function' && typeof fg.camera === 'function') {
        const cam = fg.camera();
        if (cam) {
          const dist = Math.hypot(cam.x, cam.y, cam.z) || 200;
          const angle = Math.atan2(cam.z, cam.x) + speed;
          const newX = Math.cos(angle) * dist;
          const newZ = Math.sin(angle) * dist;
          fg.cameraPosition({ x: newX, y: cam.y, z: newZ }, { x: 0, y: 0, z: 0 }, 0);
        }
      }
      autoRotateRef.current = requestAnimationFrame(tick);
    };
    autoRotateRef.current = requestAnimationFrame(tick);
  }, [graphRef]);

  useEffect(() => stopAutoRotate, [stopAutoRotate, viewMode]);

  const setAutoRotate = useCallback(
    (enabled: boolean) => {
      if (enabled) startAutoRotate();
      else stopAutoRotate();
    },
    [startAutoRotate, stopAutoRotate],
  );

  const zoomToFit = useCallback(
    (duration = 500, padding = 80) => {
      const fg = graphRef.current;
      if (!fg) return;
      if (typeof fg.zoomToFit === 'function') fg.zoomToFit(duration, padding);
    },
    [graphRef],
  );

  const resetView = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    if (typeof fg.cameraPosition === 'function') {
      fg.cameraPosition({ x: 0, y: 0, z: 220 }, { x: 0, y: 0, z: 0 }, 600);
    }
    setTimeout(() => zoomToFit(400, 60), 220);
  }, [graphRef, zoomToFit]);

  const toggleViewMode = useCallback(() => {
    onViewModeChange(viewMode === '3d' ? '2d' : '3d');
  }, [viewMode, onViewModeChange]);

  return { zoomToFit, setAutoRotate, resetView, toggleViewMode };
}
