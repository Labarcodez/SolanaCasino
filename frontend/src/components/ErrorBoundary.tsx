import { Component, type ErrorInfo, type ReactNode } from "react";
import { BRAND } from "../lib/brand";
import { Logo } from "./Logo";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`${BRAND.name} error:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <Logo size="lg" />
          <h2>{this.props.label ? `${this.props.label} crashed` : "Something went wrong"}</h2>
          <p>
            {this.props.label
              ? "This game hit an error. Other tabs still work — try reloading this section."
              : "Refresh the page or reconnect your wallet to continue."}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginLeft: 8 }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
