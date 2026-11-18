import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "SME MIS — Price & Stock Control",
    template: "%s | SME MIS",
  },
  description:
    "Manage store prices, monitor stock, and find approved prices at participating small businesses.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
