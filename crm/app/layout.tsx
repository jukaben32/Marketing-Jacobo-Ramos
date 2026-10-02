import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Oficina Jacobo Ramos — Atención ciudadana",
  description: "Panel de la oficina legislativa del diputado Jacobo Ramos: solicitudes ciudadanas, contactos y recepcionista telefónico con IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/*
          Script que se ejecuta ANTES de pintar la página para aplicar el tema
          guardado (localStorage) al instante. Sin esto, la página se vería
          primero en claro y luego "parpadearía" a oscuro tras cargar React.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("jr-oficina-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
