import { Outlet } from '@tanstack/react-router';
import { Header } from './Header';

export function RootLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 px-4 py-10 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
