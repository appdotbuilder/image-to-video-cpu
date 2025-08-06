
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ImageIcon, UploadIcon, XIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { VideoProject, Image, UploadImageInput } from '../../../server/src/schema';

interface ImageUploaderProps {
  project: VideoProject;
  existingImages: Image[];
  onImageUploaded: (image: Image) => void;
}

interface PendingImage {
  id: string;
  file: File;
  preview: string;
  orderIndex: number;
  isUploading: boolean;
  uploadProgress: number;
}

export function ImageUploader({ project, existingImages, onImageUploaded }: ImageUploaderProps) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const getNextOrderIndex = useCallback(() => {
    const maxExisting = existingImages.length > 0 
      ? Math.max(...existingImages.map((img: Image) => img.order_index))
      : -1;
    const maxPending = pendingImages.length > 0 
      ? Math.max(...pendingImages.map((img: PendingImage) => img.orderIndex))
      : -1;
    return Math.max(maxExisting, maxPending) + 1;
  }, [existingImages, pendingImages]);

  const handleFileSelect = useCallback((files: FileList) => {
    const imageFiles = Array.from(files).filter((file: File) => file.type.startsWith('image/'));
    
    const newPendingImages = imageFiles.map((file: File, index: number) => ({
      id: `${Date.now()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
      orderIndex: getNextOrderIndex() + index,
      isUploading: false,
      uploadProgress: 0
    }));

    setPendingImages((prev: PendingImage[]) => [...prev, ...newPendingImages]);
  }, [getNextOrderIndex]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const removePendingImage = useCallback((id: string) => {
    setPendingImages((prev: PendingImage[]) => {
      const imageToRemove = prev.find((img: PendingImage) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter((img: PendingImage) => img.id !== id);
    });
  }, []);

  const moveImage = useCallback((id: string, direction: 'up' | 'down') => {
    setPendingImages((prev: PendingImage[]) => {
      const currentIndex = prev.findIndex((img: PendingImage) => img.id === id);
      if (currentIndex === -1) return prev;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newArray = [...prev];
      [newArray[currentIndex], newArray[newIndex]] = [newArray[newIndex], newArray[currentIndex]];
      
      // Update order indices
      return newArray.map((img: PendingImage, index: number) => ({
        ...img,
        orderIndex: getNextOrderIndex() + index - newArray.length
      }));
    });
  }, [getNextOrderIndex]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 content
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const uploadImage = useCallback(async (pendingImage: PendingImage) => {
    setPendingImages((prev: PendingImage[]) => 
      prev.map((img: PendingImage) => 
        img.id === pendingImage.id 
          ? { ...img, isUploading: true, uploadProgress: 0 }
          : img
      )
    );

    try {
      // Simulate upload progress
      for (let progress = 10; progress <= 90; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setPendingImages((prev: PendingImage[]) => 
          prev.map((img: PendingImage) => 
            img.id === pendingImage.id 
              ? { ...img, uploadProgress: progress }
              : img
          )
        );
      }

      const base64Data = await fileToBase64(pendingImage.file);
      
      const uploadData: UploadImageInput = {
        project_id: project.id,
        filename: pendingImage.file.name,
        file_data: base64Data,
        mime_type: pendingImage.file.type,
        order_index: pendingImage.orderIndex
      };

      const uploadedImage = await trpc.uploadImage.mutate(uploadData);
      
      setPendingImages((prev: PendingImage[]) => 
        prev.map((img: PendingImage) => 
          img.id === pendingImage.id 
            ? { ...img, uploadProgress: 100 }
            : img
        )
      );

      // Wait a moment to show 100% progress, then remove from pending
      setTimeout(() => {
        setPendingImages((prev: PendingImage[]) => {
          const imageToRemove = prev.find((img: PendingImage) => img.id === pendingImage.id);
          if (imageToRemove) {
            URL.revokeObjectURL(imageToRemove.preview);
          }
          return prev.filter((img: PendingImage) => img.id !== pendingImage.id);
        });
        onImageUploaded(uploadedImage);
      }, 500);
      
    } catch (error) {
      console.error('Failed to upload image:', error);
      setPendingImages((prev: PendingImage[]) => 
        prev.map((img: PendingImage) => 
          img.id === pendingImage.id 
            ? { ...img, isUploading: false, uploadProgress: 0 }
            : img
        )
      );
    }
  }, [project.id, onImageUploaded]);

  const uploadAllImages = useCallback(async () => {
    const imagesToUpload = pendingImages.filter((img: PendingImage) => !img.isUploading);
    for (const image of imagesToUpload) {
      await uploadImage(image);
    }
  }, [pendingImages, uploadImage]);

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <Card 
        className={`border-2 border-dashed transition-colors ${
          dragOver 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8 text-center">
          <UploadIcon className={`h-12 w-12 mx-auto mb-4 ${dragOver ? 'text-purple-500' : 'text-gray-400'}`} />
          <div className="space-y-2">
            <p className="text-lg font-medium">Drop images here or click to browse</p>
            <p className="text-sm text-gray-500">
              Support for PNG, JPG, GIF and other image formats
            </p>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.files) {
                handleFileSelect(e.target.files);
              }
            }}
            className="hidden"
            
            id="file-input"
          />
          <Button
            asChild
            variant="outline"
            className="mt-4"
          >
            <label htmlFor="file-input" className="cursor-pointer">
              Browse Files
            </label>
          </Button>
        </CardContent>
      </Card>

      {/* Pending Images */}
      {pendingImages.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Ready to Upload ({pendingImages.length})
              </h3>
              <Button 
                onClick={uploadAllImages}
                disabled={pendingImages.some((img: PendingImage) => img.isUploading)}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                Upload All
              </Button>
            </div>
            
            <div className="grid gap-3">
              {pendingImages.map((image: PendingImage, index: number) => (
                <div key={image.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                    <img 
                      src={image.preview} 
                      alt={image.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{image.file.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{(image.file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <Badge variant="outline" className="text-xs">
                        Order: {image.orderIndex + 1}
                      </Badge>
                    </div>
                    
                    {image.isUploading && (
                      <div className="mt-2">
                        <Progress value={image.uploadProgress} className="h-2" />
                        <p className="text-xs text-gray-500 mt-1">
                          Uploading... {image.uploadProgress}%
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {!image.isUploading && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveImage(image.id, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUpIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveImage(image.id, 'down')}
                        disabled={index === pendingImages.length - 1}
                      >
                        <ArrowDownIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => uploadImage(image)}
                        className="bg-green-50 hover:bg-green-100"
                      >
                        <UploadIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removePendingImage(image.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">📋 Upload Instructions</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Images will appear in your video in the order shown (you can reorder them)</li>
          <li>• Each image will be displayed for {project.duration_per_image} seconds</li>
          <li>• The final video will run at {project.fps} FPS</li>
          <li>• Supported formats: PNG, JPG, GIF, WebP, and more</li>
        </ul>
      </div>
    </div>
  );
}
