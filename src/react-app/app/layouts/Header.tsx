import { Link } from '@tanstack/react-router';

const navLinkClass =
  'relative flex h-14 items-center px-3 text-sm text-muted-foreground transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity hover:text-foreground data-[status=active]:text-foreground data-[status=active]:after:opacity-100';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center gap-6 px-4">
        <Link to="/" className="font-heading text-sm font-semibold tracking-tight">
          My App
        </Link>
        <nav className="flex items-center">
          <Link to="/" className={navLinkClass}>
            ホーム
          </Link>
          <Link to="/example-todo" className={navLinkClass}>
            Todo
          </Link>
        </nav>
      </div>
    </header>
  );
}
