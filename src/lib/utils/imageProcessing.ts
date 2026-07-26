export interface ProcessedImage {
  id: string
  originalName: string
  src: string // Data URL or Blob URL
  width: number
  height: number
  isSliced: boolean
  partIndex: number
  totalParts: number
}

const MAX_WEBTOON_HEIGHT = 4000
const TARGET_WIDTH = 1080

/**
 * Reads an image file and processes it for Webtoon standards.
 * If the image is extremely long, it slices it into multiple segments.
 * If the image is too wide/narrow, it calculates padding/resizing to fit TARGET_WIDTH.
 */
export async function processWebtoonImage(file: File): Promise<ProcessedImage[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const results: ProcessedImage[] = []
        
        // Calculate resize ratio to fit TARGET_WIDTH exactly
        const scale = TARGET_WIDTH / img.width
        const scaledHeight = Math.round(img.height * scale)

        // If it's a short image, just resize it
        if (scaledHeight <= MAX_WEBTOON_HEIGHT) {
          const canvas = document.createElement('canvas')
          canvas.width = TARGET_WIDTH
          canvas.height = scaledHeight
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, TARGET_WIDTH, scaledHeight)
            results.push({
              id: crypto.randomUUID(),
              originalName: file.name,
              src: canvas.toDataURL('image/jpeg', 0.9),
              width: TARGET_WIDTH,
              height: scaledHeight,
              isSliced: false,
              partIndex: 1,
              totalParts: 1
            })
          }
          resolve(results)
          return
        }

        // Image is too tall, we need to slice it
        const numSlices = Math.ceil(scaledHeight / MAX_WEBTOON_HEIGHT)
        for (let i = 0; i < numSlices; i++) {
          const sliceHeight = i === numSlices - 1 
            ? scaledHeight - (i * MAX_WEBTOON_HEIGHT) 
            : MAX_WEBTOON_HEIGHT

          const canvas = document.createElement('canvas')
          canvas.width = TARGET_WIDTH
          canvas.height = sliceHeight
          const ctx = canvas.getContext('2d')
          
          if (ctx) {
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            
            // Draw the specific vertical chunk
            // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
            const sourceY = (i * MAX_WEBTOON_HEIGHT) / scale
            const sourceHeight = sliceHeight / scale
            
            ctx.drawImage(
              img, 
              0, sourceY, img.width, sourceHeight, 
              0, 0, TARGET_WIDTH, sliceHeight
            )

            results.push({
              id: crypto.randomUUID(),
              originalName: `${file.name} (Part ${i + 1})`,
              src: canvas.toDataURL('image/jpeg', 0.9),
              width: TARGET_WIDTH,
              height: sliceHeight,
              isSliced: true,
              partIndex: i + 1,
              totalParts: numSlices
            })
          }
        }
        
        resolve(results)
      }
      img.onerror = reject
      if (e.target?.result) {
        img.src = e.target.result as string
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
