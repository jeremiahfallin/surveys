"use client";
import { useAuth } from "./AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Box, Button, Flex, Link } from "@radix-ui/themes";

export function Navigation() {
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Box asChild>
      <nav>
        <Flex justify="between">
          <Link href="/">Voting App</Link>
          <Flex gap="2">
            <Link href="/polls">Polls</Link>
            {user ? (
              <>
                <Link href="/create-poll">Create Poll</Link>
                <Link asChild>
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
