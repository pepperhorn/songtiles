import '@testing-library/jest-dom';

// Ensure built-in registries are populated before any test renders Tiles or
// dispatches via group/game registries.
import '../src/tiles/builtin';
import '../src/groups/builtin';
import '../src/games/builtin';

// jsdom doesn't implement matchMedia; provide a no-op stub so ThemeProvider doesn't crash.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
