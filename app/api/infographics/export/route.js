import { NextResponse } from 'next/server';
import { generatePNG, generateMultipleSizes } from '@/lib/infographics/image-generator';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');
    const format = url.searchParams.get('format') || 'png';
    const quality = url.searchParams.get('quality') || 'high';

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Create HTML content that displays the image
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
            }
            .image-container {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <div class="image-container">
            <img src="${imageUrl}" alt="Infographic" crossorigin="anonymous" />
          </div>
        </body>
      </html>
    `;

    if (format === 'social') {
      // Generate multiple social media sizes
      const formats = ['instagram', 'linkedin', 'twitter'];
      const results = await generateMultipleSizes(htmlContent, formats);

      // For multiple formats, we'll create a ZIP file or return the first one
      // For now, let's return the Instagram format as the primary
      if (results.instagram) {
        return new NextResponse(results.instagram, {
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': 'attachment; filename="infographic-instagram.png"',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }

    // For single format export
    let dimensions = { width: 1080, height: 1080 };
    let filename = 'infographic.png';

    // Set dimensions based on format
    switch (format) {
      case 'instagram':
        dimensions = { width: 1080, height: 1080 };
        filename = 'infographic-instagram.png';
        break;
      case 'linkedin':
        dimensions = { width: 1200, height: 630 };
        filename = 'infographic-linkedin.png';
        break;
      case 'twitter':
        dimensions = { width: 1200, height: 675 };
        filename = 'infographic-twitter.png';
        break;
      default:
        dimensions = { width: 1080, height: 1080 };
        filename = 'infographic.png';
    }

    const pngBuffer = await generatePNG(htmlContent, {
      ...dimensions,
      quality: quality
    });

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Direct export error:', error);
    return NextResponse.json(
      { error: 'Failed to export infographic', details: error.message },
      { status: 500 }
    );
  }
}