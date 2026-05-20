import { AuthProvider } from "@/context/AuthContext";
import BetaBanner from "@/components/BetaBanner";
import "./globals.css";

export const metadata = {
  title: "AgentifyAI",
  description: "Personal AI Agent - your own AI coach, trained on your progress.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AgentifyAI",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07080D",
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
