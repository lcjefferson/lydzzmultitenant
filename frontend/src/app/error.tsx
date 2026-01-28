'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-red-500/10 text-red-500">
            <AlertCircle className="h-12 w-12" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Algo deu errado!</h2>
        <div className="p-4 rounded-lg bg-muted/50 text-sm font-mono text-left overflow-auto max-h-48 border border-border">
          <p className="text-red-400 font-semibold">{error.name}: {error.message}</p>
          {error.stack && (
            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {error.stack.split('\n').slice(0, 3).join('\n')}...
            </pre>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()} variant="outline">
            Recarregar Página
          </Button>
          <Button onClick={() => reset()}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    </div>
  );
}
