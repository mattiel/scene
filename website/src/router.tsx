import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground">Page not found</p>
      </div>
    </div>
  );
}

export function getRouter(): ReturnType<typeof createRouter> {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
  });

  return router;
}
