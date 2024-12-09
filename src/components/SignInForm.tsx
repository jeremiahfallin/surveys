"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { Box, Button, Flex, Text, TextField } from "@radix-ui/themes";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/polls");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during authentication. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/polls");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during authentication. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <form onSubmit={handleEmailAuth}>
        <Flex direction="column" gap="4">
          <TextField.Root
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />

          <TextField.Root
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />

          {error && (
            <Text color="red" size="2">
              {error}
            </Text>
          )}

          <Button disabled={isLoading}>
            {isLoading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>

          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            Sign in with Google
          </Button>

          <Button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            variant="soft"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Need an account? Sign up"}
          </Button>
        </Flex>
      </form>
    </Box>
  );
}
