import { AuthProvider } from "@/context/AuthContext";
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
  themeColor: "#F8FAFC",
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
                  var theme = localStorage.getItem('agentify-theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <AuthProvider>
          <main className="min-h-0 w-full flex-1">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
