import "./globals.css";
import "@radix-ui/themes/styles.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { Navigation } from "@/components/Navigation";
import { Theme } from "@radix-ui/themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Voting App",
  description: "A platform for voting on various entries",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Theme>
          <AuthProvider>
            <Navigation />
            {children}
          </AuthProvider>
        </Theme>
      </body>
    </html>
  );
}
