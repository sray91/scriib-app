'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2 } from "lucide-react"

/**
 * CSVColumnMapper - A modal component for mapping CSV columns to database fields
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Array<string>} props.csvHeaders - Array of column headers from the CSV file
 * @param {Array<Object>} props.previewData - Array of first few rows for preview
 * @param {Function} props.onConfirm - Callback with the mapping object when user confirms
 */
export default function CSVColumnMapper({ isOpen, onClose, csvHeaders, previewData, onConfirm }) {
  const [mapping, setMapping] = useState({})
  const [validationErrors, setValidationErrors] = useState([])

  // Define the field configuration
  const fields = [
    { key: 'name', label: 'Name', required: true, description: 'Contact full name' },
    { key: 'profile_url', label: 'Profile URL', required: false, description: 'LinkedIn profile URL' },
    { key: 'subtitle', label: 'Subtitle', required: false, description: 'Profile subtitle/headline' },
    { key: 'job_title', label: 'Job Title', required: false, description: 'Current job title' },
    { key: 'company', label: 'Company', required: false, description: 'Current company' },
    { key: 'email', label: 'Email', required: false, description: 'Email address' },
    { key: 'engagement_type', label: 'Engagement Type', required: false, description: 'Type of engagement (like, comment)' },
    { key: 'post_url', label: 'Post URL', required: false, description: 'URL of the post where engagement occurred' },
  ]

  // Auto-detect column mappings on mount or when headers change
  useEffect(() => {
    if (csvHeaders && csvHeaders.length > 0) {
      const autoMapping = {}

      fields.forEach(field => {
        // Try to find an exact match (case-insensitive)
        const exactMatch = csvHeaders.find(
          header => header.toLowerCase().trim() === field.key.toLowerCase().trim()
        )

        if (exactMatch) {
          autoMapping[field.key] = exactMatch
          return
        }

        // Try to find a partial match for common variations
        const partialMatch = csvHeaders.find(header => {
          const headerLower = header.toLowerCase().trim()
          const fieldLower = field.key.toLowerCase().trim()

          // Handle common variations
          if (field.key === 'profile_url') {
            return headerLower.includes('profile') && (headerLower.includes('url') || headerLower.includes('link'))
          }
          if (field.key === 'job_title') {
            return headerLower.includes('job') || headerLower.includes('title') || headerLower === 'position'
          }

          return headerLower.includes(fieldLower) || fieldLower.includes(headerLower)
        })

        if (partialMatch) {
          autoMapping[field.key] = partialMatch
        }
      })

      setMapping(autoMapping)
    }
  }, [csvHeaders])

  // Validate the mapping
  useEffect(() => {
    const errors = []

    // Check required fields
    fields.forEach(field => {
      if (field.required && !mapping[field.key]) {
        errors.push(`${field.label} is required`)
      }
    })

    // Check for duplicate mappings
    const usedHeaders = Object.values(mapping).filter(Boolean)
    const duplicates = usedHeaders.filter((header, index) => usedHeaders.indexOf(header) !== index)

    if (duplicates.length > 0) {
      errors.push(`Multiple fields mapped to same column: ${duplicates.join(', ')}`)
    }

    setValidationErrors(errors)
  }, [mapping])

  const handleMappingChange = (fieldKey, csvColumn) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: csvColumn === 'none' ? null : csvColumn
    }))
  }

  const handleConfirm = () => {
    if (validationErrors.length > 0) {
      return
    }

    // Create reverse mapping (CSV column -> field key)
    const reverseMapping = {}
    Object.entries(mapping).forEach(([fieldKey, csvColumn]) => {
      if (csvColumn) {
        reverseMapping[csvColumn] = fieldKey
      }
    })

    onConfirm(reverseMapping)
  }

  const getPreviewValue = (csvColumn) => {
    if (!previewData || previewData.length === 0 || !csvColumn) return ''

    const firstRow = previewData[0]
    const columnIndex = csvHeaders.indexOf(csvColumn)

    if (columnIndex === -1) return ''

    return firstRow[columnIndex] || ''
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map CSV Columns</DialogTitle>
          <DialogDescription>
            Match your CSV columns to the contact fields. Required fields are marked with an asterisk (*).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.map(field => (
            <div key={field.key} className="grid grid-cols-3 items-start gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <p className="text-xs text-muted-foreground">{field.description}</p>
              </div>

              <div className="col-span-2 space-y-2">
                <Select
                  value={mapping[field.key] || 'none'}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger className={field.required && !mapping[field.key] ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select a column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Don&apos;t map</span>
                    </SelectItem>
                    {csvHeaders.map(header => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {mapping[field.key] && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    <span className="font-medium">Preview: </span>
                    {getPreviewValue(mapping[field.key]) || <span className="italic">empty</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800">Please fix the following issues:</p>
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {validationErrors.length === 0 && Object.keys(mapping).length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-sm font-medium text-green-800">Mapping looks good!</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={validationErrors.length > 0}
            className="bg-[#fb2e01] hover:bg-[#e02a01]"
          >
            Import Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
