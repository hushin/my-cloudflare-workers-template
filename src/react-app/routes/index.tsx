import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@/react-app/pages/home';

export const Route = createFileRoute('/')({
  component: HomePage,
});
