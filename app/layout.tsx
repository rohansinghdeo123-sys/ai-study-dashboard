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
        {/* Theme script – runs before paint, no flash */}
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
      <body className="flex flex-col min-h-screen bg-terminal-950 text-terminal-50 transition-colors duration-300">
        <AuthProvider>
          <BetaBanner />
          {/* MAIN CENTERED CONTAINER – fills screen width with safe paddings */}
          <main className="flex-1 w-full mx-auto px-4 md:px-6 lg:px-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}