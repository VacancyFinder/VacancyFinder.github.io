import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** A crash in one page shouldn't blank the whole app: show a way out instead. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("Rekiya page error", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }): void {
    // Navigating elsewhere clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="card mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          This page hit an unexpected problem. Your saved jobs and settings are safe on this device.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="/jobs/" className="btn-secondary" onClick={() => this.setState({ error: null })}>
            Go to jobs
          </a>
        </div>
      </div>
    );
  }
}
