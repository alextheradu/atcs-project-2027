import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Pascack Course Planner",
  description: "Unofficial student tool for planning high school courses. Not affiliated with the school district.",
  appleWebApp: { capable: true, title: "Course Planner", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#161616" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} antialiased`}>
      <body className="min-h-screen">{children}<PwaRegister /></body>
    </html>
  );
}
