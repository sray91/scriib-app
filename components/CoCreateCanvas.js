'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { Play } from 'lucide-react';

// Import our refactored modules
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { nodeTypes } from '@/components/canvas-blocks';
import { 
  useCanvasNodes,
  useCanvasKeyboardShortcuts,
  useCanvasEvents,
  usePostCompilation
} from '@/lib/hooks/useCanvasOperations';
import { CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';

// Main Canvas Component
const CoCreateCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const { initializeSession } = useCanvasStore();
  
  // Use our custom hooks
  const { addNode, addConnectedBlock, removeNode } = useCanvasNodes(nodes, setNodes, edges, setEdges);
  const { compilePost } = usePostCompilation();
  
  // Handle node selection
  const onSelectionChange = useCallback((elements) => {
    const nodeIds = elements.nodes.map(node => node.id);
    setSelectedNodes(nodeIds);
  }, []);
  
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);
  
  // Wrapper for post compilation with loading state
  const handleCompilePost = async () => {
    setIsLoading(true);
    await compilePost();
    setIsLoading(false);
  };
  
  // Initialize session and setup default ideation block
  useEffect(() => {
    initializeSession();
    
    // Add default ideation block
    const defaultIdeationBlock = {
      id: 'ideation-default',
      type: 'ideationBlock',
      position: CANVAS_SETTINGS.DEFAULT_NODE_POSITION,
      data: { 
        label: 'ideation',
        onUpdate: (updates) => {
          setNodes(nds => nds.map(node => 
            node.id === 'ideation-default' 
              ? { ...node, data: { ...node.data, ...updates } }
              : node
          ));
        }
        // No onClose function for the default ideation block
      },
    };
    
    setNodes([defaultIdeationBlock]);
  }, [initializeSession, setNodes]);
  
  // Setup event listeners and keyboard shortcuts
  useCanvasKeyboardShortcuts(addNode, handleCompilePost, selectedNodes, setSelectedNodes, setNodes, isLoading);
  useCanvasEvents(addConnectedBlock, removeNode);
  
  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        multiSelectionKeyCode="Control"
        deleteKeyCode="Delete"
        selectNodesOnDrag={false}
      >
        <MiniMap />
        <Background />
        
        {/* Controls Panel */}
        <Panel position="bottom-right" style={{ marginRight: '10px', marginBottom: '10px' }}>
          <Controls showZoom={true} showFitView={true} showInteractive={true} />
        </Panel>
        
        {/* Top Panel */}
        <Panel position="top-right">
          <div className="flex gap-2">
            <Button 
              onClick={handleCompilePost} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isLoading ? 'Compiling...' : 'Compile Post'}
            </Button>
          </div>
        </Panel>
        

        

      </ReactFlow>
    </div>
  );
};

export default function CoCreateCanvasWrapper() {
  return (
    <ReactFlowProvider>
      <CoCreateCanvas />
    </ReactFlowProvider>
  );
} 