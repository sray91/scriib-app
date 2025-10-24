'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertCircle } from 'lucide-react'

export default function PostScraperProgress({ posts, currentPost, overallProgress }) {
  return (
    <div className="space-y-4 w-full max-w-4xl mx-auto">
      {/* Overall Progress Header */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Scraping Your LinkedIn Posts
        </h3>
        <p className="text-sm text-muted-foreground">
          {overallProgress?.message || 'Initializing...'}
        </p>
      </div>

      {/* Individual Post Progress Bars */}
      <div className="space-y-3">
        <AnimatePresence mode="sync">
          {posts.map((post, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <PostProgressCard
                postNumber={index + 1}
                post={post}
                isActive={currentPost === index}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function PostProgressCard({ postNumber, post, isActive }) {
  const { status, likersProgress, commentersProgress, totalContacts } = post

  // Calculate overall progress for this post (0-100)
  const overallProgress =
    status === 'completed' ? 100 :
    status === 'error' ? 0 :
    ((likersProgress + commentersProgress) / 2)

  return (
    <div className={`
      border rounded-lg p-4 transition-all duration-300
      ${isActive ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : 'border-border bg-card'}
      ${status === 'completed' ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : ''}
      ${status === 'error' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' : ''}
    `}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          {status === 'completed' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            >
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="h-5 w-5 text-white" />
              </div>
            </motion.div>
          )}
          {status === 'processing' && (
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
          {status === 'error' && (
            <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
          )}
          {status === 'pending' && (
            <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {postNumber}
              </span>
            </div>
          )}

          <div className="flex-1">
            <div className="font-medium text-sm">Post {postNumber}</div>
            {totalContacts > 0 && (
              <div className="text-xs text-muted-foreground">
                {totalContacts} contacts found
              </div>
            )}
          </div>
        </div>

        {/* Progress Percentage */}
        {status === 'processing' && (
          <motion.div
            key={overallProgress}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-sm font-semibold text-blue-600 dark:text-blue-400"
          >
            {Math.round(overallProgress)}%
          </motion.div>
        )}
      </div>

      {/* Progress Bars Container */}
      {(status === 'processing' || status === 'completed') && (
        <div className="space-y-2">
          {/* Likers Progress Bar */}
          <EngagementProgressBar
            label="Likers"
            progress={likersProgress}
            color="blue"
          />

          {/* Commenters Progress Bar */}
          <EngagementProgressBar
            label="Commenters"
            progress={commentersProgress}
            color="green"
          />
        </div>
      )}
    </div>
  )
}

function EngagementProgressBar({ label, progress, color }) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-200 dark:bg-blue-900',
      fill: 'bg-blue-500 dark:bg-blue-400'
    },
    green: {
      bg: 'bg-green-200 dark:bg-green-900',
      fill: 'bg-green-500 dark:bg-green-400'
    }
  }

  const colors = colorClasses[color]

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium">{Math.round(progress)}%</span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${colors.bg}`}>
        <motion.div
          className={`h-full ${colors.fill}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
