/**
 * Records the current tab/window video plus the app's audio output into a
 * webm clip and triggers a download.
 *
 * - Video: getDisplayMedia (browser's "pick a tab/window" picker).
 * - Audio: a MediaStreamDestination tapped off the engine's master node so we
 *          capture the synth output directly (avoids tab-mic loopback issues).
 *
 * The caller passes a `runPlayback` thunk that starts playback; the function
 * resolves when playback ends OR after a hard-cap timeout. Stops/disposes
 * everything cleanly on cancel or error.
 */
export interface RecordOptions {
  audioContext: AudioContext;
  masterNode: AudioNode;
  /** Start playback and return a promise that resolves when it ends. */
  runPlayback: () => Promise<void>;
  /** Hard cap, default 60s. Recording stops automatically at this point. */
  maxDurationMs?: number;
  /** Filename stem (no extension), default 'doremino'. */
  filenameStem?: string;
}

export async function recordToFile(opts: RecordOptions): Promise<void> {
  const { audioContext, masterNode, runPlayback, maxDurationMs = 60_000, filenameStem = 'doremino' } = opts;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }
  if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Screen capture (getDisplayMedia) is not supported in this browser.');
  }

  // 1) Ask the user to pick a tab/window for the video.
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: false,
  });

  // 2) Tap audio off the engine's master node.
  const audioDest = audioContext.createMediaStreamDestination();
  masterNode.connect(audioDest);

  // 3) Combine: video tracks from the display stream + audio tracks from our tap.
  const combined = new MediaStream([
    ...displayStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  // 4) Pick the best mime type the browser supports.
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
  const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  // 5) If the user stops sharing via the browser bar, abort gracefully.
  const userEndedShare = new Promise<void>(resolve => {
    for (const t of displayStream.getTracks()) t.addEventListener('ended', () => resolve());
  });

  const cleanup = () => {
    try { masterNode.disconnect(audioDest); } catch { /* ignored */ }
    for (const t of displayStream.getTracks()) t.stop();
    for (const t of audioDest.stream.getTracks()) t.stop();
  };

  recorder.start(250);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const hardCap = new Promise<void>(resolve => {
    timeoutId = setTimeout(() => resolve(), maxDurationMs);
  });

  try {
    await Promise.race([runPlayback(), userEndedShare, hardCap]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // Wait for the final chunk to flush.
  await new Promise<void>(resolve => {
    recorder.onstop = () => resolve();
    if (recorder.state !== 'inactive') recorder.stop();
    else resolve();
  });
  cleanup();

  if (chunks.length === 0) throw new Error('No video data captured.');
  const blob = new Blob(chunks, { type: chunks[0].type || mimeType || 'video/webm' });
  const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameStem}-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
