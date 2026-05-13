import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import BetaBanner from "@/components/BetaBanner";

export const metadata = {
  title: "AgentifyAI",
  description: "Personal AI Agent – your own AI coach, trained on your progress.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to set theme before paint – prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('agentify-theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-terminal-950 text-terminal-50 min-h-screen flex flex-col transition-colors duration-300">
        <AuthProvider>
          <BetaBanner />
          <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}