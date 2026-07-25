import { Link } from '@tanstack/react-router';
import { signOut, useSession } from '@/react-app/shared/api';
import { Button } from '@/react-app/shared/ui';

export function Header() {
  const { data: session, isPending } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link to="/" className="mr-6 font-heading text-lg font-semibold tracking-tight">
          My App
        </Link>
        <nav className="flex flex-1 items-center gap-4 text-sm font-medium">
          <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
            Home
          </Link>
          <Link
            to="/example-todo"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Todos
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {isPending ? null : session ? (
            <>
              <span className="text-sm text-muted-foreground">{session.user.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void signOut();
                }}
              >
                サインアウト
              </Button>
            </>
          ) : (
            <Button size="sm" render={<Link to="/sign-in" />}>
              サインイン
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
