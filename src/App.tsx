import { ThemeProvider, useTheme } from './theme/ThemeProvider';

function Inner() {
  const { tokens } = useTheme();
  return (
    <div
      className="app-root grid place-items-center min-h-screen"
      style={{
        backgroundColor: tokens.canvasBg,
        color: tokens.textPrimary,
      }}
    >
      Songtiles
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Inner />
    </ThemeProvider>
  );
}
