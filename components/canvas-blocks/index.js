// Import all block components
import IdeationBlock from './IdeationBlock';
import HookBlock from './HookBlock';
import VisualBlock from './VisualBlock';
import ContentBlock from './ContentBlock';
import CTABlock from './CTABlock';

// Re-export individual components
export { default as IdeationBlock } from './IdeationBlock';
export { default as HookBlock } from './HookBlock';
export { default as VisualBlock } from './VisualBlock';
export { default as ContentBlock } from './ContentBlock';
export { default as CTABlock } from './CTABlock';

// Node types mapping for React Flow
export const nodeTypes = {
  ideationBlock: IdeationBlock,
  hookBlock: HookBlock,
  visualBlock: VisualBlock,
  contentBlock: ContentBlock,
  ctaBlock: CTABlock,
}; 