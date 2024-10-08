import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertToAscii(str: string): string {
  // Implementation needed
  return str.replace(/[^\x00-\x7F]/g, "");
}