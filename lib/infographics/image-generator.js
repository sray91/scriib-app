// PNG Generation utility using Puppeteer
import puppeteer from 'puppeteer'

/**
 * Generate PNG from HTML content
 * @param {string} htmlContent - HTML content to render
 * @param {Object} options - Generation options
 * @param {number} [options.width] - Image width in pixels
 * @param {number} [options.height] - Image height in pixels
 * @param {string} [options.quality] - Quality setting ('low', 'medium', 'high')
 * @param {boolean} [options.transparent] - Whether background should be transparent
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generatePNG(htmlContent, options = {}) {
  const {
    width = 1080,
    height = 1080,
    quality = 'high',
    transparent = false
  } = options

  let browser
  try {
    // Launch browser with optimized settings for server environments
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: 30000,
      protocolTimeout: 30000
    })

    const page = await browser.newPage()

    // Set viewport to desired dimensions
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: getDeviceScaleFactor(quality)
    })

    // Set content with proper CSS for print
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              ${transparent ? 'background: transparent;' : ''}
            }
            .infographic-container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            /* Ensure text is crisp */
            * {
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            /* Print-specific styles */
            @media print {
              body { margin: 0; }
              .infographic-container {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `

    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })

    // Wait for any custom fonts to load
    await page.evaluateHandle('document.fonts.ready')

    // Generate screenshot (PNG doesn't support quality parameter)
    const screenshot = await page.screenshot({
      type: 'png',
      width,
      height,
      omitBackground: transparent,
      optimizeForSpeed: quality === 'low'
    })

    return screenshot
  } catch (error) {
    console.error('PNG generation error:', error)
    throw new Error(`Failed to generate PNG: ${error.message}`)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * Generate multiple sizes for social media platforms
 * @param {string} htmlContent - HTML content to render
 * @param {string[]} formats - Array of format names
 * @returns {Promise<Object>} Object with format names as keys and buffers as values
 */
export async function generateMultipleSizes(htmlContent, formats = ['instagram', 'linkedin', 'twitter']) {
  const sizes = {
    instagram: { width: 1080, height: 1080 }, // Square
    linkedin: { width: 1200, height: 630 },   // Landscape
    twitter: { width: 1200, height: 675 },    // Landscape
    story: { width: 1080, height: 1920 },     // Portrait
    pinterest: { width: 1000, height: 1500 }  // Tall portrait
  }

  const results = {}

  for (const format of formats) {
    if (sizes[format]) {
      try {
        results[format] = await generatePNG(htmlContent, sizes[format])
      } catch (error) {
        console.error(`Failed to generate ${format} size:`, error)
        results[format] = null
      }
    }
  }

  return results
}

/**
 * Generate preview thumbnail
 * @param {string} htmlContent - HTML content to render
 * @returns {Promise<Buffer>} Small preview image buffer
 */
export async function generatePreview(htmlContent) {
  return generatePNG(htmlContent, {
    width: 400,
    height: 400,
    quality: 'medium'
  })
}

/**
 * Validate HTML content before generation
 * @param {string} htmlContent - HTML to validate
 * @returns {Object} Validation result
 */
export function validateHtmlContent(htmlContent) {
  const errors = []
  const warnings = []

  // Basic HTML structure validation
  if (!htmlContent || typeof htmlContent !== 'string') {
    errors.push('HTML content is required and must be a string')
  }

  if (htmlContent && htmlContent.length > 1000000) { // 1MB limit
    errors.push('HTML content is too large (max 1MB)')
  }

  // Check for potentially problematic content
  if (htmlContent && htmlContent.includes('<script>')) {
    warnings.push('Script tags detected - they will be ignored during rendering')
  }

  if (htmlContent && !htmlContent.includes('infographic-container')) {
    warnings.push('No infographic-container class found - layout may not render correctly')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Get device scale factor based on quality setting
 */
function getDeviceScaleFactor(quality) {
  switch (quality) {
    case 'high': return 2
    case 'medium': return 1.5
    case 'low': return 1
    default: return 1.5
  }
}

/**
 * Optimize HTML for rendering
 * @param {string} htmlContent - Original HTML
 * @returns {string} Optimized HTML
 */
export function optimizeHtmlForRendering(htmlContent) {
  return htmlContent
    // Remove script tags for security and performance
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove external resource references that might slow down rendering
    .replace(/src="https?:\/\/[^"]*"/g, '')
    // Ensure all images have alt attributes
    .replace(/<img(?![^>]*alt=)/g, '<img alt=""')
    // Add loading="eager" to images
    .replace(/<img/g, '<img loading="eager"')
}

/**
 * Error handling wrapper for PNG generation
 * @param {Function} generationFunction - Function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export function withErrorHandling(generationFunction) {
  return async (...args) => {
    try {
      return await generationFunction(...args)
    } catch (error) {
      console.error('Image generation error:', error)

      // Return error information that can be handled by the calling code
      throw {
        message: error.message,
        code: error.code || 'GENERATION_ERROR',
        details: error.stack,
        timestamp: new Date().toISOString()
      }
    }
  }
}