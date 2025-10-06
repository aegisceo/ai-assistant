import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { AuthGuard } from '@/components/auth/AuthGuard';
import './globals.css';

export const metadata: Metadata = {
    title: 'AI Assistant',
    description: 'AI-powered digital assistant for neurodivergent professionals',
};

export default function RootLayout({
    children,
}: {
    readonly children: React.ReactNode;
}): JSX.Element {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    <AuthGuard>
                        {children}
                    </AuthGuard>
                </AuthProvider>
            </body>
        </html>
    );
}
