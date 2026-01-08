import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const { userId, sessionClaims } = await auth();

  // If not logged in, show welcome page
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              MES MVP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-gray-600">
              Manufacturing Execution System for Motor Assembly
            </p>
            <p className="text-sm text-gray-500">
              Phase-1 MVP - Event-driven architecture aligned with ISA-95
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Button asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/sign-up">Create Account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get role from session claims (typed via globals.d.ts)
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const role = metadata?.role;

  // Redirect based on role
  if (role === 'admin') {
    redirect('/admin');
  } else if (role === 'supervisor') {
    redirect('/dashboard');
  } else {
    // Default to operator station selection
    redirect('/station');
  }
}
