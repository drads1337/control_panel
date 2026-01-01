"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface AvatarCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageFile: File | null
  onCropComplete: (file: File, cropData: { x: number; y: number; width: number; height: number }) => void
}

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageFile,
  onCropComplete,
}: AvatarCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Load image when file changes
  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader()
      reader.onload = () => {
        setImageSrc(reader.result as string)
      }
      reader.readAsDataURL(imageFile)
    } else {
      setImageSrc(null)
      setCrop({ x: 0, y: 0, width: 100, height: 100 })
    }
  }, [imageFile])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setImageSrc(null)
      setCrop({ x: 0, y: 0, width: 100, height: 100 })
      setIsProcessing(false)
    }
  }, [open])

  // Initialize crop when image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const size = Math.min(img.naturalWidth, img.naturalHeight)
    const x = (img.naturalWidth - size) / 2
    const y = (img.naturalHeight - size) / 2
    
    setCrop({
      x: (x / img.naturalWidth) * 100,
      y: (y / img.naturalHeight) * 100,
      width: (size / img.naturalWidth) * 100,
      height: (size / img.naturalHeight) * 100,
    })
  }, [])

  // Create cropped image
  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current || !imageFile) return null

    const img = imgRef.current
    const canvas = canvasRef.current
    if (!canvas) return null

    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height

    const cropX = (crop.x / 100) * img.naturalWidth
    const cropY = (crop.y / 100) * img.naturalHeight
    const cropWidth = (crop.width / 100) * img.naturalWidth
    const cropHeight = (crop.height / 100) * img.naturalHeight

    canvas.width = cropWidth
    canvas.height = cropHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(
      img,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    )

    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return
        const file = new File([blob], imageFile.name, { type: imageFile.type })
        resolve(file)
      }, imageFile.type, 0.95)
    })
  }, [crop, imageFile])

  const handleCropComplete = useCallback(async () => {
    if (!imageFile) return

    setIsProcessing(true)
    try {
      const croppedFile = await getCroppedImg()
      if (croppedFile) {
        const img = imgRef.current
        if (img) {
          const scaleX = img.naturalWidth / img.width
          const scaleY = img.naturalHeight / img.height
          
          const cropData = {
            x: (crop.x / 100) * img.naturalWidth * scaleX,
            y: (crop.y / 100) * img.naturalHeight * scaleY,
            width: (crop.width / 100) * img.naturalWidth * scaleX,
            height: (crop.height / 100) * img.naturalHeight * scaleY,
          }
          
          onCropComplete(croppedFile, cropData)
        }
      }
    } catch (error) {
      console.error('Error cropping image:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [crop, imageFile, getCroppedImg, onCropComplete])

  const handleCancel = () => {
    setImageSrc(null)
    setCrop({ x: 0, y: 0, width: 100, height: 100 })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Crop Avatar</DialogTitle>
          <DialogDescription className="text-xs">
            Select the image area for your avatar. The image will be cropped to a square.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center p-2 sm:p-4">
          {imageSrc && (
            <div className="relative w-full max-h-[60vh] overflow-hidden rounded-lg border">
              <img
                ref={imgRef}
                alt="Crop"
                src={imageSrc}
                className="w-full h-auto max-h-[60vh] object-contain"
                onLoad={onImageLoad}
              />
              {/* Simple crop overlay - in a real implementation, you'd use a library like react-image-crop */}
              <div 
                className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
                }}
              />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className="h-8 text-xs w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCropComplete}
            disabled={!imageSrc || isProcessing}
            className="h-8 text-xs w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Processing...
              </>
            ) : (
              'Apply'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


