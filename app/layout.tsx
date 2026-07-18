import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guess the Song",
  description: "Party game — adivina la canción lo más rápido posible.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
