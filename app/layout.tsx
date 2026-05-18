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
      <body className="flex min-h-screen flex-col bg-[#07080D] text-slate-100 antialiased">
        <AuthProvider>
          <BetaBanner />
          <main className="min-h-0 w-full flex-1">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
