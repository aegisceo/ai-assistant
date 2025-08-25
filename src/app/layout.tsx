import type { Metadata } from 'next';

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
            <body>{children}</body>
        </html>
    );
}
