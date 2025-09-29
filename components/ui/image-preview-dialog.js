import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

export default function ImagePreviewDialog({
  isOpen,
  onOpenChange,
  imageUrl,
  imageName = "Preview Image",
  imageType
}) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = imageName;
      link.click();
    }
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset zoom and position when dialog opens/closes
  const handleOpenChange = (open) => {
    if (!open) {
      handleReset();
    }
    onOpenChange(open);
  };

  if (!imageUrl) return null;

  const isVideo = imageType?.startsWith('video/');
  const isPdf = imageType === 'application/pdf' || imageUrl?.toLowerCase().endsWith('.pdf');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-hidden bg-black/95"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black/70 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium truncate max-w-md">{imageName}</h3>
              {!isVideo && !isPdf && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.25}
                    className="text-white hover:bg-white/20"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm min-w-[60px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    className="text-white hover:bg-white/20"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-white hover:bg-white/20"
                  >
                    Reset
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-white hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="w-full h-full flex items-center justify-center pt-20 pb-4">
          {isVideo ? (
            <video
              src={imageUrl}
              controls
              className="max-w-full max-h-full object-contain"
              autoPlay={false}
            >
              Your browser does not support the video tag.
            </video>
          ) : isPdf ? (
            <div className="w-full h-full bg-white rounded-lg overflow-hidden">
              <iframe
                src={imageUrl}
                className="w-full h-full"
                title={imageName}
              />
            </div>
          ) : (
            <div
              className="relative w-full h-full flex items-center justify-center overflow-hidden"
              style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
              onMouseDown={handleMouseDown}
            >
              <div
                className="transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                  transformOrigin: 'center center'
                }}
              >
                <Image
                  src={imageUrl}
                  alt={imageName}
                  width={800}
                  height={600}
                  className="max-w-[80vw] max-h-[70vh] object-contain"
                  unoptimized={imageUrl?.startsWith('blob:')}
                  draggable={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* Instructions for zoomed images */}
        {zoom > 1 && !isVideo && !isPdf && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded text-sm">
            Click and drag to pan
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}