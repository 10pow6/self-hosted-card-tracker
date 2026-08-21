import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { error: Error | null };

// Last-resort crash screen so a render error never leaves a blank page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-svh grid place-items-center bg-background text-foreground px-6">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold">Something broke</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The app hit an unexpected error. Your data is safe on the backend — reload to
              continue.
            </p>
            <pre className="mt-4 rounded-lg border border-border bg-card p-3 text-left text-xs text-muted-foreground overflow-x-auto">
              {this.state.error.message}
            </pre>
            <Button className="mt-5" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
