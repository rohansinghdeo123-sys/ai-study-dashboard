import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import BetaBanner from "@/components/BetaBanner";

export const metadata = {
  title: "AI Study Dashboard",
  description: "Modern AI Learning Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white">
        <AuthProvider>

          {/* Beta Banner */}
          <BetaBanner />

          {children}

        </AuthProvider>
      </body>
    </html>
  );
}