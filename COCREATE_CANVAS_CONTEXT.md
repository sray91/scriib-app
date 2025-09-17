# CoCreate Canvas - Context & Architecture

## Overview
The CoCreate Canvas is a visual, node-based content creation system built with React Flow. It provides an interactive canvas where users can create, connect, and manage different content generation blocks to collaboratively build social media posts (primarily LinkedIn).

**Architecture Status**: ✅ **Refactored** - The component has been modularized from a single 1400-line file into a maintainable architecture with separation of concerns.

## Refactored Architecture (January 2025)

### File Structure
```
components/
├── CoCreateCanvas.js (134 lines) - Main canvas component
└── canvas-blocks/
    ├── index.js - Consolidated exports
    ├── IdeationBlock.js (~100 lines)
    ├── HookBlock.js (~100 lines)
    ├── VisualBlock.js (~100 lines)
    ├── ContentBlock.js (~100 lines)
    └── CTABlock.js (~100 lines)

lib/
├── stores/
│   └── canvasStore.js (183 lines) - Zustand state management
├── hooks/
│   └── useCanvasOperations.js (309 lines) - Custom canvas hooks
└── constants/
    └── canvasConfig.js (125 lines) - Configuration and templates
```

### 1. State Management (`lib/stores/canvasStore.js`)
Extracted Zustand store with clean separation of concerns:

```javascript
const useCanvasStore = create((set, get) => ({
  // Session management
  session: null,
  initializeSession: async () => { ... },
  
  // User context loading
  loadUserContext: async (userId) => { ... },
  
  // Dynamic context updates
  updateDynamicContext: (updates) => { ... },
  addToHistory: (interaction) => { ... }
}))
```

**Features**:
- Session initialization with unique session IDs
- User context loading from Supabase (past posts, training documents)
- Dynamic context management during canvas sessions
- Conversation history tracking
- Fallback support for anonymous users

### 2. Custom Hooks (`lib/hooks/useCanvasOperations.js`)
Four specialized hooks for canvas operations:

#### `useCanvasNodes(nodes, setNodes, edges, setEdges)`
- **addNode(type)**: Creates new nodes with proper positioning
- **addConnectedBlock(type, sourceNodeId)**: Connects new blocks to existing ones
- **removeNode(nodeId)**: Safely removes nodes and their connections

#### `useCanvasKeyboardShortcuts(...args)`
- Ctrl+1-4: Quick add block types
- Ctrl+Enter: Compile post
- Delete/Backspace: Remove selected nodes
- Prevents shortcuts during text input

#### `useCanvasEvents(addConnectedBlock, removeNode)`
- Custom event listeners for inter-block communication
- `addConnectedBlock` and `removeNode` event handling
- Automatic cleanup on unmount

#### `usePostCompilation()`
- **compilePost()**: Assembles content from all blocks
- Supabase integration with fallback error handling
- Content validation and user authentication checks
- Session context clearing after successful compilation

### 3. Configuration (`lib/constants/canvasConfig.js`)
Centralized configuration management:

```javascript
// Visual templates for VisualBlock
export const VISUAL_TEMPLATES = [
  { id: 'myth-vs-fact', name: 'Myth vs. Fact', preview: '/images/templates/myth-vs-fact.png' },
  // ... 8 more templates
];

// Block themes and colors
export const BLOCK_THEMES = {
  ideation: { primary: '#3B82F6', secondary: '#EFF6FF' },
  hook: { primary: '#10B981', secondary: '#ECFDF5' },
  // ... more themes
};

// Keyboard shortcuts, API endpoints, canvas settings
export const KEYBOARD_SHORTCUTS = { ... };
export const API_ENDPOINTS = { ... };
export const CANVAS_SETTINGS = { ... };
```

### 4. Block Components (`components/canvas-blocks/`)
Each block extracted to its own file with consistent patterns:

- **Common Props**: `data`, `isConnectable`
- **Event Handling**: `onUpdate`, `onClose` callbacks
- **Theme Integration**: Color schemes from constants
- **API Integration**: Dedicated API calls per block type
- **Context Awareness**: Access to session store

**Export Pattern**:
```javascript
// components/canvas-blocks/index.js
export { default as IdeationBlock } from './IdeationBlock';
export { default as HookBlock } from './HookBlock';
// ... etc

export const nodeTypes = {
  ideationBlock: IdeationBlock,
  hookBlock: HookBlock,
  // ... etc
};
```

### 5. Main Component (`components/CoCreateCanvas.js`)
Simplified to 134 lines with clean architecture:

```javascript
const CoCreateCanvas = () => {
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Custom hooks
  const { initializeSession } = useCanvasStore();
  const { addNode, addConnectedBlock, removeNode } = useCanvasNodes(nodes, setNodes, edges, setEdges);
  const { compilePost } = usePostCompilation();
  
  // Event setup
  useCanvasKeyboardShortcuts(addNode, handleCompilePost, selectedNodes, setSelectedNodes, setNodes, isLoading);
  useCanvasEvents(addConnectedBlock, removeNode);
  
  // Minimal render with ReactFlow
  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} /* ... */ />
  );
};
```

## Original Architecture (Pre-Refactor)

### Legacy State Management (Zustand Store)
The application uses Zustand for global state management through `useCanvasStore`:

```javascript
const useCanvasStore = create((set, get) => ({
  session: null,
  initializeSession: async () => { ... },
  loadUserContext: async (userId) => { ... },
  updateDynamicContext: (updates) => { ... },
  addToHistory: (interaction) => { ... }
}))
```

#### Session Structure
- **Session ID**: Unique identifier for each canvas session
- **User ID**: Authentication-based user identification
- **Intrinsic Context**: Static user data available to all blocks
  - User voice analysis
  - Training documents
  - Trending insights
  - User preferences
  - Past posts
- **Dynamic Context**: Generated content during the session
  - Ideas
  - Hooks
  - Themes
  - Target audience
  - Generated content
- **Conversation History**: Session interaction log

### Core Dependencies
- **React Flow**: Canvas and node management
- **Supabase**: Authentication and data persistence
- **Zustand**: State management
- **Shadcn/UI**: Component library
- **Lucide React**: Icons

## Block Components

### 1. IdeationBlock (Brain Icon - Blue Theme)
**Location**: `components/canvas-blocks/IdeationBlock.js`
**Purpose**: Primary content brainstorming and idea generation

**Features**:
- Chat-style interface for ideation
- AI-powered content generation via `/api/cocreate`
- Auto-updates session's dynamic context with generated ideas
- Plus button for connecting to other block types
- Dropdown menu to add connected blocks (Visual, Hook, CTA)

**API Integration**: 
```javascript
POST /api/cocreate
Body: { userMessage, action: 'create' }
```

### 2. HookBlock (Fish Icon - Green Theme)
**Location**: `components/canvas-blocks/HookBlock.js`
**Purpose**: Generate compelling opening hooks for content

**Features**:
- Generates 3 hook variations
- Requires connection to IdeationBlock for content
- Uses latest idea from session context
- Closeable (can be removed)
- Updates session context with generated hooks

### 3. VisualBlock (Image Icon - Purple Theme)
**Location**: `components/canvas-blocks/VisualBlock.js`
**Purpose**: Create infographics and visual content

**Features**:
- **Step 0**: Generation method selection
  - Generate via Prompt: Create infographic from text description
  - Use Template: Choose from 9 predefined templates
  - Upload Reference: Use uploaded image as reference
- **Step 1**: Template selection or image upload (depending on method)
  - Templates: Myth vs. Fact, 12 Info Blocks, Cheat Sheet, 10 Brutal Truths, Listicle, 8 Radial Options, 5 Lessons, Roadmap, 7 Things About Archetype
  - Upload: Drag-and-drop interface for reference images
- **Step 2**: Content input with context
- **Step 3**: Generated visual display
- Auto-populates content from connected ideation blocks
- Downloads generated visuals
- Integrates with `/api/infogen/generate` and `/api/infogen/upload`

### 4. ContentBlock (Type Icon - Orange Theme)
**Location**: `components/canvas-blocks/ContentBlock.js`
**Purpose**: Compile and edit final content

**Features**:
- Compiles content from connected blocks
- Combines hooks and ideas
- Manual editing capabilities
- Updates session with final compiled content

### 5. CTABlock (Target Icon - Red Theme)
**Location**: `components/canvas-blocks/CTABlock.js`
**Purpose**: Generate call-to-action options

**Features**:
- Creates 3 CTA variations
- Focuses on engagement and connection
- Requires existing content from ideation blocks
- Standard CTA templates for LinkedIn

## Main Canvas Component

### Features
- **Node Management**: Add, remove, connect blocks
- **Keyboard Shortcuts**:
  - `Ctrl/Cmd + 1-4`: Quick add blocks
  - `Ctrl/Cmd + Enter`: Compile post
  - `Delete/Backspace`: Remove selected nodes (smart input detection prevents conflicts)
  - **Input Protection**: Keyboard shortcuts disabled when typing in input fields
  - **Default Block Protection**: Initial ideation block cannot be deleted
- **Visual Flow**: React Flow with minimap, controls, background
- **Multi-selection**: Control+click for multiple node selection

### Event System
Custom events for inter-block communication:
- `addConnectedBlock`: Add connected blocks from plus button
- `removeNode`: Remove blocks via close button

### Node Connection
- Automatic edge creation between connected blocks
- Animated edges for visual feedback
- Context sharing between connected blocks

## Content Compilation Process

### 1. Validation
- Checks for available content in session context
- Validates user authentication for saving

### 2. Content Assembly
```javascript
// Hook + Main Content Structure
let finalContent = '';
if (latestHook) {
  finalContent += latestHook.content + '\n\n';
}
if (latestGeneratedContent || latestIdea) {
  finalContent += content;
}
```

### 3. Post Creation
- Saves to Post Forge database via `/api/posts/create`
- Fallback to direct Supabase insertion
- Includes metadata about source blocks
- Handles media attachment for visuals

### 4. Session Management
- Clears dynamic context after successful compilation
- Maintains conversation history
- Preserves intrinsic context for future sessions

## API Integrations

### Content Generation
- **Endpoint**: `/api/cocreate`
- **Purpose**: AI-powered content and hook generation
- **Input**: User message, action type
- **Output**: Generated content, updated post

### Visual Generation (via VisualBlock)
- **Generate Endpoint**: `/api/infogen/generate`
- **Upload Endpoint**: `/api/infogen/upload`
- **Purpose**: Create infographics from text content within the canvas workflow
- **Input**: Content, context, template ID (optional), reference image (optional)
- **Output**: Generated image URL

### Post Management
- **Endpoint**: `/api/posts/create`
- **Purpose**: Save compiled posts to Post Forge
- **Input**: Post data with metadata
- **Output**: Saved post confirmation

## Data Flow

### 1. Session Initialization
```
User loads canvas → Initialize session → Load user context → Display default ideation block
```

### 2. Content Creation
```
User interacts with blocks → Generate content → Update dynamic context → Share between connected blocks
```

### 3. Compilation
```
User compiles → Validate content → Assemble final post → Save to database → Clear session
```

## User Experience Features

### Visual Design
- Color-coded blocks by function
- Consistent iconography (Lucide React)
- Responsive resizable blocks
- Professional UI with shadcn components

### Workflow
- Default ideation block on load
- Progressive content building
- Non-destructive editing
- Real-time context updates

### Error Handling
- Toast notifications for user feedback
- Graceful fallbacks for API failures
- Validation messages for missing content
- Anonymous session support

## Integration Points

### Supabase Tables
- `past_posts`: User's historical content for voice analysis
- `training_documents`: User's uploaded content for context
- `posts`: Compiled posts storage
- `post_media`: Visual content attachments

### Authentication
- Supabase Auth integration
- Anonymous session fallback
- User-specific context loading

### External APIs
- CoCreate API for content generation
- Visual generation API (via VisualBlock) for infographic creation
- Post Forge integration for final storage

## Extension Points

### Adding New Block Types
1. Create new block component in `components/canvas-blocks/`
2. Add to `nodeTypes` object in `index.js`
3. Implement in dropdown menus and keyboard shortcuts
4. Update session context structure in store
5. Add theme configuration in constants

### Template System
- Visual block supports custom templates
- Template metadata and preview images stored in constants
- Extensible template configuration

### API Integration
- Modular API calling structure within individual hooks
- Centralized endpoint configuration
- Error handling patterns for graceful degradation

## Refactoring Benefits

### Maintainability
- **90% size reduction**: Main component from 1400 → 134 lines
- **Separation of concerns**: Logic, UI, and configuration isolated
- **Single responsibility**: Each module has a clear purpose

### Developer Experience
- **Testability**: Individual hooks and components easily testable
- **Reusability**: Store and hooks can be used across components
- **Debugging**: Smaller files easier to debug and understand

### Performance
- **Tree shaking**: Only import what's needed
- **Code splitting**: Potential for lazy loading blocks
- **Bundle optimization**: Smaller individual modules

### Scalability
- **New features**: Easy to add new block types or canvas features
- **Team development**: Multiple developers can work on different modules
- **Documentation**: Each module is self-documenting 