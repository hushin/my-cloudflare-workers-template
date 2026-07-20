import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Header } from '@/react-app/components/header';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
