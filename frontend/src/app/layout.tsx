import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volunteer Coordination Platform",
  description: "Smart Resource Allocation — NGO Coordination",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
