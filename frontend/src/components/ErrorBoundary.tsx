/**
 * evinourish-web/src/components/ErrorBoundary.tsx
 * -------------------------------------------------
 * React class-based Error Boundary for the web app.
 * Catches any unhandled render error thrown by a descendant component
 * and shows a friendly recovery UI with a Retry button.
 *
 * Usage in main.tsx (or App.tsx):
 *   import ErrorBoundary from './components/ErrorBoundary';
 *
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Prop / State Types
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ErrorBoundary — wraps any subtree and catches render-time exceptions.
 * On error, renders a centred "Something went wrong. Please try again."
 * screen with a Retry button that resets boundary state.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    this._handleRetry = this._handleRetry.bind(this);
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // TODO: pipe to Sentry / Datadog once telemetry is configured.
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  _handleRetry() {
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={fallbackStyles.container}>
          <span style={fallbackStyles.icon}>⚠️</span>
          <h2 style={fallbackStyles.heading}>Something went wrong.</h2>
          <p style={fallbackStyles.subheading}>Please try again.</p>
          <button style={fallbackStyles.button} onClick={this._handleRetry}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Inline styles (keeps the component self-contained, no Tailwind dependency)
// ---------------------------------------------------------------------------

const fallbackStyles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    background: '#FAFAFA',
    fontFamily: 'system-ui, sans-serif',
    padding: '24px',
    textAlign: 'center',
  },
  icon: {
    fontSize: '52px',
    lineHeight: 1,
  },
  heading: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#333333',
    margin: 0,
  },
  subheading: {
    fontSize: '16px',
    color: '#636366',
    margin: 0,
  },
  button: {
    marginTop: '16px',
    padding: '14px 48px',
    fontSize: '16px',
    fontWeight: 700,
    color: '#FFFFFF',
    backgroundColor: '#007AFF',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,122,255,0.3)',
  },
};
