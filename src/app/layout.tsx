import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'MES MVP - Manufacturing Execution System',
  description: 'Phase-1 Manufacturing Execution System for Motor Assembly',
};

const clerkEnabled =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('REPLACE_ME');

async function AuthWrapper({ children }: { children: React.ReactNode }) {
  if (!clerkEnabled) {
    return <>{children}</>;
  }
  const { ClerkProvider, UserButton, SignedIn } = await import('@clerk/nextjs');
  return (
    <ClerkProvider>
      <SignedIn>
        <div className="fixed top-4 right-4 z-50">
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: "w-10 h-10"
              }
            }}
          />
        </div>
      </SignedIn>
      {children}
    </ClerkProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('mes-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <ThemeProvider>
          <AuthWrapper>
            {children}
          </AuthWrapper>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
