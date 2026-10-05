import { Component, type ReactNode } from "react";
import { Button, EmptyState } from "sid-ui";
import { AcornFaceView } from "../acorn-face/AcornFaceView";

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
        <EmptyState
          icon={<AcornFaceView mode="sad" size={32} live label="Acorn" />}
          title="Something went wrong"
          description={this.state.error}
          actions={
            <Button
              variant="secondary"
              label="Try again"
              onClick={() => this.setState({ error: null })}
            />
          }
        />
      );
    }
    return this.props.children;
  }
}
