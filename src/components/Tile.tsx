import { useTheme } from '../theme/ThemeProvider';
import { getTileKind } from '../tiles/registry';
import type { Tile as TileT } from '../graph/types';

export function Tile({
  tile, size = 96, dimmed = false, shadow,
}: {
  tile: TileT;
  size?: number;
  dimmed?: boolean;
  /** Override the chunky drop shadow (e.g. tint by paint/repeat membership). */
  shadow?: string;
}) {
  const { tokens } = useTheme();
  const kind = getTileKind(tile.kind);
  if (!kind) return null;

  const extraStyle = kind.containerStyle ? kind.containerStyle({ tile, tokens }) : {};
  const className =
    `songtile ${kind.containerClassName ?? ''} relative grid place-items-center select-none`.trim();

  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: 14,
        border: '2px solid var(--chunky-edge)',
        boxShadow: `${shadow ?? tokens.tileShadow}, ${tokens.tileBevel}`,
        opacity: dimmed ? 0.4 : 1,
        ...extraStyle,
      }}
    >
      {kind.renderContent({ tile, size, tokens })}
    </div>
  );
}
