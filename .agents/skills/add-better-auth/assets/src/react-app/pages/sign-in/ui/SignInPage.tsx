import { signIn } from '@/react-app/shared/api';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/react-app/shared/ui';

export function SignInPage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>サインイン</CardTitle>
          <CardDescription>GitHub アカウントでログインします。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => {
              void signIn.social({ provider: 'github', callbackURL: '/' });
            }}
          >
            GitHub でサインイン
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
