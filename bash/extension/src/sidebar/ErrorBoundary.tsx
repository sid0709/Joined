import { Component, type ReactNode } from "react";
import { OakFaceView } from "../oak-face/OakFaceView";

interface Props {
  children: ReactNode;
}

interface State {
  error: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(err: unknown): State {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <OakFaceView mode="sad" size={32} live label="Oak" />
          <h3>Something went wrong</h3>
          <p>{this.state.error}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
