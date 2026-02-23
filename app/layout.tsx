import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

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
        <div className="flex">
          <Sidebar />

          <div className="flex-1 flex flex-col min-h-screen">
            <Navbar />

            <main className="flex-1 p-8 bg-gray-950">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}