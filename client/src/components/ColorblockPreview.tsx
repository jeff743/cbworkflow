import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ColorblockPreviewProps {
  heading?: string;
  content: string;
  headingFontSize: number;
  statementFontSize: number;
  textAlignment: "left" | "center" | "right";
  backgroundColor: string;
  backgroundImageUrl?: string;
}

export function ColorblockPreview({
  heading,
  content,
  headingFontSize,
  statementFontSize,
  textAlignment,
  backgroundColor,
  backgroundImageUrl,
}: ColorblockPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const previewSize = isMobilePreview ? 200 : 320;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1080;
    canvas.height = 1080;

    // Clear canvas
    ctx.clearRect(0, 0, 1080, 1080);

    const drawColorblock = async () => {
      // Set background
      if (backgroundImageUrl) {
        try {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => {
            ctx.drawImage(image, 0, 0, 1080, 1080);
            // Add dark overlay for text readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, 1080, 1080);
            drawText();
          };
          image.onerror = (error) => {
            console.error("Error loading background image:", error, "URL:", backgroundImageUrl);
            // Fallback to solid color
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, 1080, 1080);
            drawText();
          };
          
          // Convert relative path to full URL if needed
          const imageUrl = backgroundImageUrl.startsWith('/') 
            ? `${window.location.origin}${backgroundImageUrl}`
            : backgroundImageUrl;
          
          // console.log("Loading background image from:", imageUrl);
          
          image.src = imageUrl;
        } catch (error) {
          console.error("Error loading background image:", error);
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, 1080, 1080);
          drawText();
        }
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, 1080, 1080);
        drawText();
      }
    };

    const drawText = () => {
      // Set text properties
      ctx.fillStyle = 'white';
      ctx.textAlign = textAlignment === 'left' ? 'left' : 
                    textAlignment === 'right' ? 'right' : 'center';

      const centerX = 540;
      const padding = 80;

      let currentY = 540; // Center vertically

      // Calculate text layout
      if (heading && content) {
        // Both heading and content
        currentY = 400; // Start higher to accommodate both
      }

      // Draw heading if present
      if (heading) {
        ctx.font = `bold ${headingFontSize}px Inter, Arial, sans-serif`;
        const headingLines = wrapText(ctx, heading, 1080 - (padding * 2));
        
        headingLines.forEach((line, index) => {
          const x = textAlignment === 'left' ? padding :
                    textAlignment === 'right' ? 1080 - padding : centerX;
          ctx.fillText(line, x, currentY + (index * headingFontSize * 1.2));
        });
        
        currentY += headingLines.length * headingFontSize * 1.2 + 40;
      }

      // Draw content
      if (content) {
        ctx.font = `${statementFontSize}px Inter, Arial, sans-serif`;
        const contentLines = wrapText(ctx, content, 1080 - (padding * 2));
        
        // If no heading, center the content vertically
        if (!heading) {
          const totalHeight = contentLines.length * statementFontSize * 1.2;
          currentY = (1080 - totalHeight) / 2 + statementFontSize;
        }
        
        contentLines.forEach((line, index) => {
          const x = textAlignment === 'left' ? padding :
                    textAlignment === 'right' ? 1080 - padding : centerX;
          ctx.fillText(line, x, currentY + (index * statementFontSize * 1.2));
        });
      }
    };

    drawColorblock();
  }, [heading, content, headingFontSize, statementFontSize, textAlignment, backgroundColor, backgroundImageUrl]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `colorblock-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 bg-white pb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Live Preview</h4>
      </div>
      
      <div className="flex justify-center">
        <div className="relative">
          {/* Colorblock Preview */}
          <canvas
            ref={canvasRef}
            className="border border-gray-200 rounded-lg shadow-lg"
            style={{ 
              width: `${previewSize}px`, 
              height: `${previewSize}px`,
              imageRendering: 'auto'
            }}
            data-testid="canvas-colorblock-preview"
          />
          
          {/* Size Indicator */}
          <div className="mt-2 text-center">
            <span className="text-xs text-gray-500">1080 × 1080 px</span>
          </div>
        </div>
      </div>

      {/* Preview Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="mobile-preview" className="text-sm text-gray-600">
            Mobile Preview
          </Label>
          <Switch
            id="mobile-preview"
            checked={isMobilePreview}
            onCheckedChange={setIsMobilePreview}
            data-testid="switch-mobile-preview"
          />
        </div>
        
        <Button 
          onClick={handleDownload}
          variant="outline"
          className="w-full"
          data-testid="button-download-preview"
        >
          <i className="fas fa-download mr-2"></i>
          Download Preview
        </Button>
      </div>
    </div>
  );
}

// Helper function to wrap text with line break support
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  // First split by line breaks to preserve manual line breaks
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      // Empty line - add space for visual separation
      lines.push('');
      continue;
    }

    // Word wrap each paragraph
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  
  return lines;
}
