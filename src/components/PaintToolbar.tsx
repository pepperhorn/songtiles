import type { CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import type { PaintTool } from '../graph/types';

const TOOLS: Array<{ tool: Exclude<PaintTool, null>; label: string; icon: string }> = [
  { tool: 'chord',  label: 'Chord',  icon: '♬' },
  { tool: 'arp',    label: 'Arp',    icon: '∿' },
  { tool: 'eraser', label: 'Erase',  icon: '⌫' },
];

export function PaintToolbar() {
  const { tokens } = useTheme();
  const tool = useAppStore(s => s.paintTool);
  const setTool = useAppStore(s => s.setPaintTool);

  const btnStyle: CSSProperties = {
    background: tokens.topBarBg,
    color: tokens.textPrimary,
    boxShadow: tokens.tileShadow,
    pointerEvents: 'auto',
  };
  const TOOL_COLOR: Record<Exclude<PaintTool, null>, string> = {
    chord: '#3b82f6',
    arp: '#a855f7',
    eraser: '#ef4444',
  };

  return (
    <>
      {TOOLS.map(t => {
        const isActive = tool === t.tool;
        return (
          <button
            key={t.tool}
            type="button"
            className={`paint-tool-btn paint-tool-${t.tool} px-3 py-2 rounded-full font-medium text-sm flex items-center gap-1`}
            style={isActive ? { ...btnStyle, background: TOOL_COLOR[t.tool], color: '#fff' } : btnStyle}
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
