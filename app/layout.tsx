import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Friday — Personal AI Assistant",
  description: "A beautiful private workspace for your Colab-powered AI assistant.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
