"use client";
import { SignInForm } from "@/components/SignInForm";
import { Box, Heading } from "@radix-ui/themes";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/polls");
    }
  }, [user, router]);

  return (
    <Box className="container mx-auto py-8">
      <Heading size="6" align="center" mb="6">
        Sign In to Voting App
      </Heading>
      <SignInForm />
    </Box>
  );
}
