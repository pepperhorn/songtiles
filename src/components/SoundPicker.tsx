import { useState, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

interface PatchOption {
  /** Display name shown to the user. */
  label: string;
  /** Patch name passed through to engine.setPatch (matches smplr's instrument name). */
  patchName: string;
}

// All patches must support our note range: midi 36..84 (C2..C6), plus bass
// voices clamped to C2..B2. GM Soundfonts cover the full range. Mallets
// (Vibraphone/Xylophone/Tubular Bells) only sample from F3+, so bass voices
// fall silent — excluded. Mellotron tape patches are 35-key (~G2..F5 =
// 43..77); none cover our full range, so all Mellotrons are excluded too.
const PATCHES: PatchOption[] = [
  { label: 'Acoustic Grand Piano',     patchName: 'acoustic_grand_piano' },
  { label: 'Electric Piano',           patchName: 'electric_piano_1' },
  { label: 'Harpsichord',              patchName: 'harpsichord' },
  { label: 'Celesta',                  patchName: 'celesta' },
  { label: 'Music Box',                patchName: 'music_box' },
  { label: 'Marimba',                  patchName: 'marimba' },
  { label: 'Church Organ',             patchName: 'church_organ' },
  { label: 'Drawbar Organ',            patchName: 'drawbar_organ' },
  { label: 'Acoustic Guitar (nylon)',  patchName: 'acoustic_guitar_nylon' },
  { label: 'Pad: Warm',                patchName: 'pad_2_warm' },
];

export function SoundPicker() {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const patchId = useAppStore(s => s.patchId);
  const setPatch = (name: string) => {
    // The store doesn't expose setPatch directly because the engine swap is async.
    // Reach into the store fields to update patchId, and ask the engine to load.
    setLoading(true);
    useAppStore.setState({ patchId: name });
    // initAudio() was wired to load the current patch; simplest reuse.
    useAppStore.getState().initAudio();
    // Flip loading off after a short delay; the engine's onLoadingChange would
    // be the proper hook, but for v1 the picker just shows a brief spinner.
    setTimeout(() => setLoading(false), 1200);
  };

  const btnStyle: CSSProperties = {
    background: tokens.topBarBg,
    color: tokens.textPrimary,
    boxShadow: tokens.tileShadow,
  };
  const optionBase: CSSProperties = {
    border: `1px solid ${tokens.gridDot}`,
    background: 'transparent',
    color: tokens.textPrimary,
  };
  const optionSelected: CSSProperties = {
    background: tokens.tilePlayhead,
    color: '#fff',
    border: `1px solid ${tokens.tilePlayhead}`,
  };

  return (
    <>
      <button
        className="sound-picker-btn px-3 py-2 rounded-full font-medium text-sm grid place-items-center"
        style={{ ...btnStyle, pointerEvents: 'auto' }}
        onClick={() => setOpen(true)}
        aria-label="open sound picker"
        title="Sound"
      >
        {/* Inline speaker glyph — works without an icon font */}
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>🔊</span>
      </button>

      {open && (
        <div
          className="sound-overlay fixed inset-0 z-40 grid place-items-center px-4"
          style={{ background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="sound-modal w-[min(420px,92vw)] p-6 rounded-3xl"
            style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sound-header flex items-center justify-between mb-4">
              <h2 className="sound-title text-2xl font-semibold">Sound</h2>
              <button
                className="sound-close text-2xl opacity-60 px-2"
                onClick={() => setOpen(false)}
                aria-label="close sound picker"
              >
                ×
              </button>
            </div>

            <div className="sound-list flex flex-col gap-2">
              {PATCHES.map(p => {
                const selected = patchId === p.patchName;
                return (
                  <button
                    key={p.patchName}
                    type="button"
                    className="sound-option px-4 py-3 rounded-2xl text-left text-base font-medium"
                    style={{ ...optionBase, ...(selected ? optionSelected : {}) }}
                    onClick={() => setPatch(p.patchName)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {loading && (
              <div
                className="sound-loading mt-4 text-sm opacity-60"
                aria-live="polite"
              >
                Loading samples…
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
