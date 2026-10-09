import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary — catches unhandled component errors and
 * renders a recovery UI instead of a white screen.
 *
 * Must be a class component because React does not yet support
 * error boundaries via hooks (getDerivedStateFromError / componentDidCatch).
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg-primary p-8">
          <div className="max-w-lg rounded-lg border border-status-alarm/60 bg-status-alarm/10 p-6 text-center">
            <h2 className="mb-2 text-xl font-semibold text-text-primary">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-text-secondary">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              onClick={this.handleReset}
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
