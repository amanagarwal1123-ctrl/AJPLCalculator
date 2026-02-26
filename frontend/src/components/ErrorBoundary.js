import { Component } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-md space-y-4">
            <AlertTriangle className="w-12 h-12 text-primary mx-auto" />
            <h2 className="heading text-xl font-bold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please try again.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { this.setState({ hasError: false, error: null }); }} data-testid="error-retry-button">
                <RefreshCw size={14} className="mr-2" /> Try Again
              </Button>
              <Button variant="secondary" onClick={() => window.history.back()} data-testid="error-go-back-button">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
