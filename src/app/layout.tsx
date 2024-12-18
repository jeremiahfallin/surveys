import "./globals.css";
import "@radix-ui/themes/styles.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navigation } from "@/components/Navigation";
import { Box, Theme } from "@radix-ui/themes";

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
      <body>
        <Theme>
          <AuthProvider>
            <Navigation />
            <Box p="4">{children}</Box>
          </AuthProvider>
        </Theme>
      </body>
    </html>
  );
}
