import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Shield, Mail, Database, Users, Lock, Eye } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 flex items-center">
          <Shield className="h-8 w-8 mr-3 text-primary" />
          Privacy Policy
        </h1>
        <p className="text-lg text-muted-foreground">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              CreatorTask (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our content creation and management platform.
            </p>
            <p>
              By using CreatorTask, you agree to the collection and use of information in accordance with this policy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Personal Information</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Name and email address when you create an account</li>
                <li>Profile information you choose to provide</li>
                <li>Communication preferences and settings</li>
              </ul>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-2">Content and Usage Data</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Content you create, edit, and publish through our platform</li>
                <li>Analytics and performance data for your content</li>
                <li>Platform usage patterns and interaction data</li>
                <li>Device information and technical logs</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Third-Party Integration Data</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Social media account information when you connect platforms</li>
                <li>API data from connected services (Twitter, etc.)</li>
                <li>Authentication tokens and permissions</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              How We Use Your Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• <strong>Service Provision:</strong> To provide, maintain, and improve our content creation tools</li>
              <li>• <strong>Content Management:</strong> To help you create, schedule, and manage your content across platforms</li>
              <li>• <strong>Analytics:</strong> To provide insights and analytics about your content performance</li>
              <li>• <strong>Communication:</strong> To send you important updates, notifications, and support responses</li>
              <li>• <strong>Security:</strong> To protect against fraud, abuse, and security threats</li>
              <li>• <strong>Legal Compliance:</strong> To comply with legal obligations and protect our rights</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="h-5 w-5 mr-2" />
              Data Security & Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
            
            <div>
              <h3 className="font-semibold mb-2">Security Measures Include:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication systems</li>
                <li>Secure cloud infrastructure with reputable providers</li>
                <li>Regular staff training on data protection practices</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Sharing and Disclosure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            
            <ul className="space-y-2 text-sm">
              <li>• <strong>Service Providers:</strong> With trusted third-party services that help us operate our platform</li>
              <li>• <strong>Connected Platforms:</strong> With social media platforms you explicitly connect to our service</li>
              <li>• <strong>Legal Requirements:</strong> When required by law or to protect our legal rights</li>
              <li>• <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li>• <strong>Consent:</strong> When you explicitly consent to sharing your information</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Rights and Choices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              You have the following rights regarding your personal information:
            </p>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2">Access & Control</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Access your personal data</li>
                  <li>Update or correct information</li>
                  <li>Delete your account and data</li>
                  <li>Export your content and data</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Privacy Controls</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Opt-out of marketing communications</li>
                  <li>Manage connected platform permissions</li>
                  <li>Control data sharing preferences</li>
                  <li>Request data processing restrictions</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Retention</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, unless a longer retention period is required by law.
            </p>
            
            <ul className="space-y-1 text-sm">
              <li>• <strong>Account Data:</strong> Retained while your account is active</li>
              <li>• <strong>Content:</strong> Retained as long as you choose to keep it on our platform</li>
              <li>• <strong>Analytics:</strong> Aggregated data may be retained for service improvement</li>
              <li>• <strong>Legal Requirements:</strong> Some data may be retained longer for legal compliance</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cookies and Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              We use cookies and similar tracking technologies to enhance your experience on our platform. These help us:
            </p>
            
            <ul className="space-y-1 text-sm">
              <li>• Remember your preferences and settings</li>
              <li>• Analyze platform usage and performance</li>
              <li>• Provide personalized content recommendations</li>
              <li>• Ensure security and prevent fraud</li>
            </ul>
            
            <p className="mt-4 text-sm">
              You can control cookie preferences through your browser settings, though some features may not work properly if cookies are disabled.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Children&apos;s Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              CreatorTask is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately so we can delete such information.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>International Data Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Your information may be transferred to and processed in countries other than your own. We ensure that such transfers comply with applicable data protection laws and that appropriate safeguards are in place to protect your information.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changes to This Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. For significant changes, we may also send you an email notification.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            
            <div className="space-y-2 text-sm">
              <p><strong>Email:</strong> privacy@creatortask.com</p>
              <p><strong>Subject Line:</strong> Privacy Policy Inquiry</p>
            </div>
            
            <p className="mt-4 text-sm text-muted-foreground">
              We will respond to your inquiry within 30 days of receipt.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 