import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MEDCNET UI rendering error:", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return <main className="fatal-error" role="alert"><div><h1>MEDCNET konnte diesen Bereich nicht anzeigen.</h1><p>Die Anwendung hat einen unerwarteten Darstellungsfehler abgefangen.</p><button onClick={() => window.location.reload()}>Seite neu laden</button></div></main>;
    }
    return this.props.children;
  }
}
