import * as FileSystem from "expo-file-system";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export async function validateDocument(
  uri: string,
  fileName: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const {
    maxSizeMB = 10,
    allowedTypes = ["pdf", "jpg", "jpeg", "png"]
  } = options;

  const errors: string[] = [];

  try {
    // Check file size
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      const info = fileInfo as FileSystem.FileInfo & { size: number };
      const fileSizeMB = info.size / (1024 * 1024);

      if (fileSizeMB > maxSizeMB) {
        errors.push(`File size must be less than ${maxSizeMB}MB`);
      }
    } else {
      errors.push("File does not exist");
    }

    // Check file type
    const fileType = fileName.split(".").pop()?.toLowerCase();
    if (!fileType || !allowedTypes.includes(fileType)) {
      errors.push(`File type must be one of: ${allowedTypes.join(", ")}`);
    }

    // Additional validations can be added here
    // - Check for file corruption
    // - Scan for malware
    // - Verify image dimensions
    // - Check PDF page count
    // etc.

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ["Error validating document"]
    };
  }
} 