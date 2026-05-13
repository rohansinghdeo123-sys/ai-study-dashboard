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
      <body className="flex flex-col min-h-screen w-full bg-terminal-950 text-terminal-50 transition-colors duration-300">
        <AuthProvider>
          <BetaBanner />
          {/* REMOVED side padding from root layout – let children handle their own spacing */}
          <main className="flex-1 w-full">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}