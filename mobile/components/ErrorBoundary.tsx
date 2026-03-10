/**
 * mobile/components/ErrorBoundary.tsx
 * -------------------------------------
 * React class-based Error Boundary that catches any unhandled JavaScript
 * error thrown by a descendant component tree during render.
 *
 * Shows a friendly "Something went wrong" screen with a Retry button
 * instead of a blank crash screen.
 *
 * Usage — wrap the root-level component in your entry point (e.g. App.tsx):
 *
 *   import ErrorBoundary from './components/ErrorBoundary';
 *
 *   export default function App() {
 *     return (
 *       <ErrorBoundary>
 *         <YourMainNavigator />
 *       </ErrorBoundary>
 *     );
 *   }
 *
 * Note: Error boundaries only catch errors during render, in lifecycle
 * methods, and in constructors of child components. They do NOT catch:
 *   - Errors inside async event handlers (use try/catch there)
 *   - Errors in the error boundary component itself
 */

import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

// ---------------------------------------------------------------------------
// Prop / State Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  /** The subtree to protect. */
  children: ReactNode;
  /**
   * Optional custom fallback UI. When provided, overrides the default
   * "Something went wrong" screen entirely.
   */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  /** Stringified error message for optional display / logging. */
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ErrorBoundary — a class component wrapping any subtree.
 * On an unhandled render error it shows a graceful recovery UI
 * with a Retry button that resets the boundary.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
    this._handleRetry = this._handleRetry.bind(this);
  }

  // Invoked after a descendant throws. Update state so the next render
  // shows the fallback UI.
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'Unknown error',
    };
  }

  // Called with the error and component stack info. Good place for logging.
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TODO: Route to Sentry / Crashlytics once telemetry is wired up.
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  /** Resets the error state so the subtree is remounted fresh. */
  _handleRetry() {
    this.setState({ hasError: false, errorMessage: null });
  }

  render() {
    // If a custom fallback was passed, delegate to it entirely.
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback;
    }

    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>

          <Text style={styles.heading}>Something went wrong.</Text>
          <Text style={styles.subheading}>Please try again.</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={this._handleRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#FAFAFA',
  },
  icon: {
    fontSize: 52,
    marginBottom: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
