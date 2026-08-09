import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import UpdateBanner from "@/components/UpdateBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bethlehem SDA 3v3",
  description: "Tournament check-in, scoring, and live standings",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100">
        {children}
        <UpdateBanner />
        <Analytics />
      </body>
    </html>
  );
}
