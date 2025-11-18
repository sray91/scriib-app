/**
 * CSV utility functions for importing and exporting CRM contacts
 */

/**
 * Convert contacts array to CSV string
 * @param {Array} contacts - Array of contact objects
 * @returns {string} CSV formatted string
 */
export function contactsToCSV(contacts) {
  if (!contacts || contacts.length === 0) {
    return ''
  }

  // Define CSV headers
  const headers = [
    'name',
    'subtitle',
    'job_title',
    'company',
    'email',
    'profile_url',
    'engagement_type',
    'post_url'
  ]

  // Create CSV header row
  const csvHeader = headers.join(',')

  // Create CSV data rows
  const csvRows = contacts.map(contact => {
    return headers.map(header => {
      const value = contact[header] || ''
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = String(value).replace(/"/g, '""')
      return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped
    }).join(',')
  })

  return [csvHeader, ...csvRows].join('\n')
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Name of the file to download
 */
export function downloadCSV(csvContent, filename = 'contacts.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Parse CSV string to array of contact objects
 * @param {string} csvContent - CSV formatted string
 * @returns {Array} Array of contact objects
 */
export function parseCSV(csvContent) {
  const lines = csvContent.split(/\r\n|\n/)

  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row')
  }

  // Parse header row
  const headers = parseCSVLine(lines[0])

  // Validate required headers
  const requiredHeaders = ['name', 'profile_url']
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingHeaders.join(', ')}`)
  }

  // Parse data rows
  const contacts = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines

    const values = parseCSVLine(line)

    if (values.length !== headers.length) {
      console.warn(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}. Skipping.`)
      continue
    }

    const contact = {}
    headers.forEach((header, index) => {
      contact[header] = values[index] || null
    })

    contacts.push(contact)
  }

  return contacts
}

/**
 * Parse a single CSV line, handling quoted fields
 * @param {string} line - CSV line
 * @returns {Array} Array of field values
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  result.push(current)

  return result
}
