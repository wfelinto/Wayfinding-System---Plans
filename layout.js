import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

export const metadata = {
  title: "Wayfinding Scoping Tool",
  description: "Plan wayfinding routes, tag messages, and scope signage from a KOP.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
