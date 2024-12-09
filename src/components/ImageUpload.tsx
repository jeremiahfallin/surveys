"use client";
import { useState } from "react";
import { Box, Button, Text } from "@radix-ui/themes";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  existingImageUrl?: string;
}

export function ImageUpload({
  onImageUploaded,
  existingImageUrl,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Create a unique filename
      const filename = `${Date.now()}-${file.name}`;
      const storageRef = ref(storage, `option-images/${filename}`);

      // Upload the file
      await uploadBytes(storageRef, file);

      // Get the download URL
      const url = await getDownloadURL(storageRef);
      onImageUploaded(url);
    } catch (err) {
      console.error("Error uploading image:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      {existingImageUrl && (
        <Box mb="2">
          <img
            src={existingImageUrl}
            alt="Option preview"
            style={{
              maxWidth: "100%",
              height: "auto",
              maxHeight: "200px",
              objectFit: "cover",
              borderRadius: "8px",
            }}
          />
        </Box>
      )}
      <Button asChild variant="soft" disabled={uploading}>
        <label style={{ cursor: "pointer" }}>
          {uploading
            ? "Uploading..."
            : existingImageUrl
            ? "Change Image"
            : "Add Image"}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
      </Button>
      {error && (
        <Text color="red" size="2" mt="1">
          {error}
        </Text>
      )}
    </Box>
  );
}
