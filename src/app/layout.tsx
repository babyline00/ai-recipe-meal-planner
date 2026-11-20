import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI-Powered Recipe & Meal Planner",
  description:
    "Plan a week of 30-minute meals that hit your macros, respect your allergies, and stay under budget — with a pantry-aware shopping list.",
  keywords: [
    "meal planner",
    "recipe",
    "macros",
    "allergies",
    "budget",
    "pantry",
    "Next.js",
    "Prisma",
  ],
  authors: [{ name: "AI Recipe & Meal Planner" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
