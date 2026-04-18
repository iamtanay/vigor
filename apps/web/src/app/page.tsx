import { redirect } from 'next/navigation';

// Root redirects:
// - The user PWA lives at /app (mobile only, guarded by middleware)
// - Gym owners go to /gym/login
// - Direct / visits → redirect to login
export default function RootPage() {
  redirect('/login');
}
