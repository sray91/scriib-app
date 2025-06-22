'use client'

import { useState, useEffect } from 'react'
import { Copy, Eye, EyeOff, RefreshCw, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSession } from '@supabase/auth-helpers-react'

export default function ExtensionsTab() {
  const [extensionToken, setExtensionToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState(null)
  const supabase = createClientComponentClient()
  const session = useSession()
  const { toast } = useToast()

  // Generate a new extension token
  const generateToken = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/linkedin/posts/sync/extension', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to generate token')
      }

      const data = await response.json()
      setExtensionToken(data.token)
      setTokenExpiry(data.expires_at)

      toast({
        title: 'Success',
        description: 'Extension token generated successfully'
      })
    } catch (error) {
      console.error('Error generating token:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate extension token',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Copy token to clipboard
  const copyToken = () => {
    navigator.clipboard.writeText(extensionToken)
    toast({
      title: 'Copied!',
      description: 'Extension token copied to clipboard'
    })
  }

  // Download extension
  const downloadExtension = () => {
    window.open('https://github.com/your-repo/linkedin-posts-extension/releases/latest', '_blank')
  }

  // Check if token is expired
  const isTokenExpired = () => {
    if (!tokenExpiry) return false
    return new Date() > new Date(tokenExpiry)
  }

  // Format expiry date
  const formatExpiry = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString()
  }

  return (
    <div className="space-y-6">
      {/* LinkedIn Posts Extension Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-white" />
            </div>
            LinkedIn Posts Browser Extension
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Import your LinkedIn posts directly from your browser. This extension bypasses API restrictions and works globally.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Installation Instructions */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-medium mb-2">How to Install & Use:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Generate your authentication token below</li>
              <li>Download and install the browser extension</li>
              <li>Copy your token to the extension settings</li>
              <li>Visit LinkedIn and click the extension to sync your posts</li>
            </ol>
          </div>

          {/* Token Generation */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="extension-token" className="text-base font-medium">
                Authentication Token
              </Label>
              <Button
                onClick={generateToken}
                disabled={isGenerating}
                variant="outline"
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                                         {extensionToken ? 'Regenerate' : 'Generate'} Token
                  </>
                )}
              </Button>
            </div>

            {extensionToken && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="extension-token"
                      type={showToken ? 'text' : 'password'}
                      value={extensionToken}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={copyToken}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Expires: {formatExpiry(tokenExpiry)}
                  </span>
                  {isTokenExpired() && (
                    <span className="text-red-500 font-medium">Token Expired</span>
                  )}
                </div>
              </div>
            )}

            {!extensionToken && (
              <p className="text-sm text-muted-foreground">
                Click &quot;Generate Token&quot; to create an authentication token for the browser extension.
              </p>
            )}
          </div>

          {/* Extension Download */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Download Extension</Label>
            <div className="flex gap-3">
              <Button
                onClick={downloadExtension}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download for Chrome
              </Button>
              <Button
                onClick={downloadExtension}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download for Firefox
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Currently in development. Manual installation required from the extension folder.
            </p>
          </div>

          {/* Status & Help */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-2">Need Help?</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Make sure you&apos;re signed in to LinkedIn before syncing</p>
              <p>• The extension works with both personal and company posts</p>
              <p>• Your data is processed securely and stored in your account only</p>
              <p>• Contact support if you encounter any issues</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="font-medium">Extension Version</Label>
              <p className="text-muted-foreground">1.0.0</p>
            </div>
            <div>
              <Label className="font-medium">Supported Browsers</Label>
              <p className="text-muted-foreground">Chrome, Firefox, Edge</p>
            </div>
            <div>
              <Label className="font-medium">Data Collected</Label>
              <p className="text-muted-foreground">Post content, engagement metrics, timestamps</p>
            </div>
            <div>
              <Label className="font-medium">Privacy</Label>
              <p className="text-muted-foreground">Data stays in your account, not shared</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 