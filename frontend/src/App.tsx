import { Component, type ReactNode } from 'react';
import AdminShell from './components/Admin/AdminShell';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'Inter, system-ui', color: '#172033', background: '#EAF1F6', height: '100vh' }}>
          <h1 style={{ fontSize: 24, marginBottom: 16, fontWeight: 800 }}>VeloCity Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#C46B58' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#9A948A', marginTop: 8 }}>{this.state.error.stack}</pre>
          <button onClick={() => window.location.reload()}
            className="btn-primary" style={{ marginTop: 20, padding: '10px 24px', fontSize: 14 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><AdminShell /></ErrorBoundary>;
}
