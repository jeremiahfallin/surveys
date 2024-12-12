"use client";
import { useState } from "react";
import Image from "next/image";
import { Box } from "@radix-ui/themes";

interface PollImageProps {
  imageUrl?: string;
  alt: string;
  width?: number;
  height?: number;
}

export function PollImage({
  imageUrl,
  alt,
  width = 200,
  height = 200,
}: PollImageProps) {
  const [error, setError] = useState(false);

  if (!imageUrl || error) {
    return (
      <Box
        style={{
          width,
          height,
          backgroundColor: "var(--gray-4)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span>No image</span>
      </Box>
    );
  }

  return (
    <Box
      style={{
        position: "relative",
        width,
        height,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 200px"
        style={{ objectFit: "cover" }}
        onError={() => setError(true)}
      />
    </Box>
  );
}
