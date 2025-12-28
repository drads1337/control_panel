import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ReactCrop, { type Crop, type PixelCrop, makeAspectCrop, centerCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Loader2 } from 'lucide-react'

interface AvatarCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageFile: File | null
  onCropComplete: (file: File, cropData: { x: number; y: number; width: number; height: number }) => void
}

const ASPECT_RATIO = 1 // Square avatar
const MIN_DIMENSION = 100
const TARGET_SIZE = 512 // Target size for cropped avatar (will be resized by backend to 300x300)

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageFile,
  onCropComplete,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

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
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
  }, [imageFile])

  // Reset crop when dialog closes
  useEffect(() => {
    if (!open) {
      setCrop(undefined)
      setCompletedCrop(undefined)
      setImageSrc(null)
    }
  }, [open])

  // Initialize crop when image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    const initialCrop = makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      ASPECT_RATIO,
      naturalWidth,
      naturalHeight
    )
    setCrop(centerCrop(initialCrop, naturalWidth, naturalHeight))
  }, [])

  // Create canvas with cropped image
  const getCroppedImg = useCallback(
    async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        return null
      }

      // Calculate scaling factors from displayed image to original
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      // Calculate actual crop dimensions in original image coordinates
      const sourceX = Math.round(crop.x * scaleX)
      const sourceY = Math.round(crop.y * scaleY)
      const sourceWidth = Math.round(crop.width * scaleX)
      const sourceHeight = Math.round(crop.height * scaleY)

      // Set canvas size to target size (square, fixed resolution)
      canvas.width = TARGET_SIZE
      canvas.height = TARGET_SIZE

      // Draw cropped image scaled to target size
      // This ensures consistent output resolution regardless of crop size
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        TARGET_SIZE,
        TARGET_SIZE
      )

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (blob) => {
            resolve(blob)
          },
          'image/png',
          0.95
        )
      })
    },
    []
  )

  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop || !imageFile) {
      return
    }

    setIsProcessing(true)
    try {
      // Get cropped image as Blob
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop)
      
      if (!croppedBlob) {
        throw new Error('Failed to crop image')
      }

      // Create File from Blob
      const croppedFile = new File([croppedBlob], imageFile.name, {
        type: 'image/png',
        lastModified: Date.now(),
      })

      // Calculate crop coordinates relative to original image
      const image = imgRef.current
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      const cropData = {
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      }

      onCropComplete(croppedFile, cropData)
      onOpenChange(false)
    } catch (error) {
      throw error
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setCrop(undefined)
    setCompletedCrop(undefined)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop Avatar</DialogTitle>
          <DialogDescription>
            Select the image area for your avatar. Drag the corners to resize.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center p-2 sm:p-4">
          {imageSrc && (
            <div className="relative w-full">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT_RATIO}
                minWidth={MIN_DIMENSION}
                minHeight={MIN_DIMENSION}
                className="max-h-[60vh]"
              >
                <img
                  ref={imgRef}
                  alt="Crop"
                  src={imageSrc}
                  style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 pb-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCropComplete}
            disabled={!completedCrop || isProcessing}
            className="w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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