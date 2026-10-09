import React from 'react';

export const App: React.FC = () => {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
          SIFT Discovery Workspace
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Evidence-backed customer feedback prioritization and insight synthesis.
        </p>
      </header>
      <section style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h2>System Status: Scaffold Initialized</h2>
        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
          Minimal vertical slice skeleton ready. Architecture: React + Vite + TypeScript.
        </p>
      </section>
    </main>
  );
};

export default App;
