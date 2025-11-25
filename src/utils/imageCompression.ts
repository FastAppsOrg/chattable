/**
 * Image Compression Utility
 * Compresses images to reduce payload size for Claude API
 */

export interface CompressedImage {
  data: string // base64 without "data:..." prefix
  media_type: string // "image/jpeg" | "image/png" | "image/webp"
}

interface CompressionOptions {
  maxWidth?: number // Default: 1568 (Claude recommended)
  maxHeight?: number // Default: 1568 (Claude recommended)
  quality?: number // Default: 0.8
  maxSizeMB?: number // Default: 0.5MB
}

/**
 * Compress image file to base64 with quality reduction
 *
 * @param file Image file to compress
 * @param options Compression options
 * @returns Compressed image data and media type
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImage> {
  const {
    maxWidth = 1568,
    maxHeight = 1568,
    quality = 0.8,
    maxSizeMB = 0.5,
  } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        // Calculate dimensions
        let { width, height } = img

        // Resize if too large
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height

          if (width > height) {
            width = Math.min(width, maxWidth)
            height = width / aspectRatio
          } else {
            height = Math.min(height, maxHeight)
            width = height * aspectRatio
          }
        }

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height)

        // Determine output format (prefer JPEG for better compression)
        const isTransparent = file.type === 'image/png' && hasTransparency(canvas)
        const outputFormat = isTransparent ? 'image/png' : 'image/jpeg'

        // Compress with quality
        let currentQuality = quality
        let dataUrl = canvas.toDataURL(outputFormat, currentQuality)

        // Iteratively reduce quality if too large
        const maxSizeBytes = maxSizeMB * 1024 * 1024
        let attempts = 0
        while (estimateBase64Size(dataUrl) > maxSizeBytes && currentQuality > 0.3 && attempts < 10) {
          currentQuality -= 0.05
          dataUrl = canvas.toDataURL(outputFormat, currentQuality)
          attempts++
        }

        // If still too large, aggressively reduce dimensions
        if (estimateBase64Size(dataUrl) > maxSizeBytes) {
          const scaleFactor = Math.sqrt(maxSizeBytes / estimateBase64Size(dataUrl))
          canvas.width = Math.floor(width * scaleFactor * 0.9) // 10% extra reduction for safety
          canvas.height = Math.floor(height * scaleFactor * 0.9)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          dataUrl = canvas.toDataURL(outputFormat, 0.75) // Use moderate quality for resized image
        }

        // Extract base64 data (remove "data:image/jpeg;base64," prefix)
        const base64Data = dataUrl.split(',')[1]

        resolve({
          data: base64Data,
          media_type: outputFormat,
        })
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<CompressedImage[]> {
  return Promise.all(files.map(file => compressImage(file, options)))
}

/**
 * Check if canvas has transparency
 */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  // Check alpha channel (every 4th byte)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true // Found transparent pixel
    }
  }

  return false
}

/**
 * Estimate base64 size in bytes
 */
function estimateBase64Size(base64: string): number {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64

  // Each base64 char = 6 bits, padding with =
  const padding = (base64Data.match(/=/g) || []).length
  return (base64Data.length * 6 - padding * 8) / 8
}

/**
 * Validate image file type
 */
export function isValidImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
