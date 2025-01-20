import "./globals.css";
import localFont from "next/font/local";
import "@radix-ui/themes/styles.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navigation } from "@/components/Navigation";
import { Box, Theme } from "@radix-ui/themes";

const quicksand = localFont({
  src: "./fonts/QuicksandVF.ttf",
  display: "swap",
  variable: "--font-quicksand",
});
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
    <html lang="en" className={quicksand.variable}>
      <body>
        <Theme style={{ height: "100%" }}>
          <Box
            style={{
              height: "100%",
              background: `linear-gradient(135deg, #a8edea, #fed6e3)`,
            }}
          >
            <AuthProvider>
              <Navigation />
              <Box p="4">{children}</Box>
            </AuthProvider>
          </Box>
        </Theme>
      </body>
    </html>
  );
}
