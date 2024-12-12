import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadImage(file: File): Promise<string> {
  const filename = `${Date.now()}-${file.name}`;
  const storageRef = ref(storage, `option-images/${filename}`);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
