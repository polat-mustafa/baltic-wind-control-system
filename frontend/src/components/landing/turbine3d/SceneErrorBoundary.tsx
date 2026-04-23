import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  area: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Scene-local error boundary for use INSIDE an R3F Canvas.
 *
 * On error it returns null (no HTML fallback — the Canvas reconciler only
 * accepts three.js objects) and logs to the console with the `area` label so
 * the rest of the scene keeps rendering instead of collapsing to the Suspense
 * fallback.
 */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SceneErrorBoundary:${this.props.area}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
