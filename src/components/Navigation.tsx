"use client";
import { useAuth } from "./AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Box, Flex, Link } from "@radix-ui/themes";
import { usePathname } from "next/navigation";

export function Navigation() {
  const { user } = useAuth();
  const pathname = usePathname();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Box asChild p="4">
      <nav>
        <Flex justify="between">
          <Link
            href="/"
            weight={pathname === "/" ? "bold" : "regular"}
            style={{
              color: pathname === "/" ? "var(--black-12)" : "var(--black-10)",
            }}
          >
            Voting App
          </Link>
          <Flex gap="4">
            <Link
              href="/polls"
              weight={pathname === "/polls" ? "bold" : "regular"}
              style={{
                color:
                  pathname === "/polls" ? "var(--black-12)" : "var(--black-10)",
              }}
            >
              Polls
            </Link>
            {user ? (
              <>
                <Link
                  href="/create-poll"
                  weight={pathname === "/create-poll" ? "bold" : "regular"}
                  style={{
                    color:
                      pathname === "/create-poll"
                        ? "var(--black-12)"
                        : "var(--black-10)",
                  }}
                >
                  Create Poll
                </Link>
                <Link
                  asChild
                  weight={pathname === "/auth" ? "bold" : "regular"}
                  style={{
                    color:
                      pathname === "/auth"
                        ? "var(--black-12)"
                        : "var(--black-10)",
                  }}
                >
                  <button onClick={handleSignOut}>Sign Out</button>
                </Link>
              </>
            ) : (
              <Link href="/auth">Sign In</Link>
            )}
          </Flex>
        </Flex>
      </nav>
    </Box>
  );
}
