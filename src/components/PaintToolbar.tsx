import type { CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import type { PaintTool } from '../graph/types';
import { listGroupTypes } from '../groups/registry';

interface ToolEntry {
  tool: Exclude<PaintTool, null>;
  label: string;
  icon: string;
  color: string;
}

export function PaintToolbar() {
  const { tokens } = useTheme();
  const tool = useAppStore(s => s.paintTool);
  const setTool = useAppStore(s => s.setPaintTool);

  const groupTools: ToolEntry[] = listGroupTypes().map(gt => ({
    tool: gt.id as Exclude<PaintTool, null>,
    label: gt.label,
    icon: gt.icon,
    color: gt.color,
  }));
  const TOOLS: ToolEntry[] = [
    ...groupTools,
    { tool: 'bass',   label: 'Bass',  icon: '↓', color: '#0ea5e9' },
    { tool: 'eraser', label: 'Erase', icon: '⌫', color: '#ef4444' },
  ];

  const btnStyle: CSSProperties = {
    background: tokens.topBarBg,
    color: tokens.textPrimary,
    pointerEvents: 'auto',
    fontWeight: 700,
  };

  return (
    <>
      {TOOLS.map(t => {
        const isActive = tool === t.tool;
        return (
          <button
            key={t.tool}
            type="button"
            className={`paint-tool-btn paint-tool-${t.tool} btn-chunky px-3 py-2 rounded-lg text-sm flex items-center gap-1`}
            style={isActive ? { ...btnStyle, background: t.color, color: '#fff' } : btnStyle}
            onClick={() => setTool(isActive ? null : t.tool)}
            aria-label={`${t.label} paint tool`}
            aria-pressed={isActive}
          >
            <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </>
  );
}
