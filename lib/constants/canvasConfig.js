// Visual Templates Configuration
export const VISUAL_TEMPLATES = [
  { 
    id: 1, 
    title: "Myth vs. Fact", 
    imageSrc: "/images/templates/myth-vs-fact.png" 
  },
  { 
    id: 2, 
    title: "12 Info Blocks", 
    imageSrc: "/images/templates/info-blocks.png" 
  },
  { 
    id: 3, 
    title: "Cheat Sheet", 
    imageSrc: "/images/templates/cheat-sheet.png" 
  },
  { 
    id: 4, 
    title: "10 Brutal Truths", 
    imageSrc: "/images/templates/brutal-truths.png" 
  },
  { 
    id: 5, 
    title: "Listicle", 
    imageSrc: "/images/templates/listicle.png" 
  },
  { 
    id: 6, 
    title: "8 Radial Options", 
    imageSrc: "/images/templates/radial-options.png" 
  },
  { 
    id: 7, 
    title: "5 Lessons", 
    imageSrc: "/images/templates/lessons.png" 
  },
  { 
    id: 8, 
    title: "Roadmap", 
    imageSrc: "/images/templates/roadmap.png" 
  },
  { 
    id: 9, 
    title: "7 Things About Archetype", 
    imageSrc: "/images/templates/archetype.png" 
  },
];

// Block Type Configurations
export const BLOCK_TYPES = {
  IDEATION: 'ideationBlock',
  HOOK: 'hookBlock',  
  VISUAL: 'visualBlock',
  CONTENT: 'contentBlock',
  CTA: 'ctaBlock'
};

// Block Theme Configurations
export const BLOCK_THEMES = {
  [BLOCK_TYPES.IDEATION]: {
    color: 'blue',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
    hoverBg: 'hover:bg-blue-100'
  },
  [BLOCK_TYPES.HOOK]: {
    color: 'green',
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50', 
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    hoverBg: 'hover:bg-green-100'
  },
  [BLOCK_TYPES.VISUAL]: {
    color: 'purple',
    borderColor: 'border-purple-200',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-800', 
    iconColor: 'text-purple-600',
    hoverBg: 'hover:bg-purple-100'
  },
  [BLOCK_TYPES.CONTENT]: {
    color: 'orange',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-800',
    iconColor: 'text-orange-600', 
    hoverBg: 'hover:bg-orange-100'
  },
  [BLOCK_TYPES.CTA]: {
    color: 'red',
    borderColor: 'border-red-200',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
    hoverBg: 'hover:bg-red-100'
  }
};

// Default CTA Templates
export const DEFAULT_CTA_TEMPLATES = [
  { id: 1, text: "💬 What's your experience with this?" },
  { id: 2, text: "🔗 Connect with me if you found this helpful!" },
  { id: 3, text: "📩 DM me for more insights like this" }
];

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  ADD_IDEATION: '1',
  ADD_HOOK: '2', 
  ADD_VISUAL: '3',
  ADD_CONTENT: '4',
  COMPILE_POST: 'Enter',
  DELETE_NODE: ['Delete', 'Backspace']
};

// API Endpoints
export const API_ENDPOINTS = {
  COCREATE: '/api/cocreate',
  INFOGEN_GENERATE: '/api/infogen/generate',
  INFOGEN_UPLOAD: '/api/infogen/upload',
  POSTS_CREATE: '/api/posts/create'
};

// Canvas Settings
export const CANVAS_SETTINGS = {
  DEFAULT_NODE_POSITION: { x: 100, y: 100 },
  CONNECTED_NODE_OFFSET: { x: 400, y: 0 },
  MIN_BLOCK_WIDTH: 350,
  VISUAL_BLOCK_WIDTH: 500,
  CHAT_HEIGHT: 160,
  TEXTAREA_ROWS: 4,
  TEMPLATES_GRID_COLS: 3,
  TEMPLATES_MAX_HEIGHT: 384 // max-h-96 equivalent
};

// Session Configuration
export const SESSION_CONFIG = {
  PAST_POSTS_LIMIT: 20,
  TRAINING_DOCS_LIMIT: 10,
  DEFAULT_SCHEDULE_DELAY_HOURS: 24
};

// Event Names for Inter-Block Communication
export const CANVAS_EVENTS = {
  ADD_CONNECTED_BLOCK: 'addConnectedBlock',
  REMOVE_NODE: 'removeNode'
};

// Default User Preferences
export const DEFAULT_USER_PREFERENCES = {
  visualStyle: 'modern',
  tone: 'professional'
};

// Fallback User Voice Analysis
export const FALLBACK_VOICE_ANALYSIS = {
  style: 'Professional',
  tone: 'Confident', 
  commonTopics: ['leadership', 'productivity', 'career growth'],
  avgLength: 850,
  usesEmojis: true,
  usesHashtags: false,
  preferredFormats: ['story', 'insight', 'tips']
}; 