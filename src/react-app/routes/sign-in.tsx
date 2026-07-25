import { createFileRoute } from '@tanstack/react-router';
import { SignInPage } from '@/react-app/pages/sign-in';

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
});
