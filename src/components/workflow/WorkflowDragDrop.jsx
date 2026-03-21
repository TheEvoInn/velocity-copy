import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, GripVertical, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BLOCK_TYPES = {
  trigger: { label: 'Trigger', icon: '🔔', color: 'bg-blue-900/30 border-blue-500/50' },
  condition: { label: 'Condition', icon: '❓', color: 'bg-purple-900/30 border-purple-500/50' },
  action: { label: 'Action', icon: '⚡', color: 'bg-emerald-900/30 border-emerald-500/50' },
  delay: { label: 'Delay', icon: '⏱️', color: 'bg-amber-900/30 border-amber-500/50' },
  filter: { label: 'Filter', icon: '🔍', color: 'bg-cyan-900/30 border-cyan-500/50' },
};

const AVAILABLE_BLOCKS = {
  trigger: [
    { id: 'trigger_scan', label: 'Scan for opportunities', icon: '🔍' },
    { id: 'trigger_schedule', label: 'Scheduled time', icon: '⏰' },
  ],
  action: [
    { id: 'action_queue', label: 'Queue task', icon: '📋' },
    { id: 'action_alert', label: 'Send alert', icon: '🔔' },
    { id: 'action_email', label: 'Send email', icon: '✉️' },
  ],
  condition: [
    { id: 'cond_value', label: 'Value check', icon: '💰' },
    { id: 'cond_platform', label: 'Platform match', icon: '🌐' },
  ],
  delay: [
    { id: 'delay_wait', label: 'Wait time', icon: '⏱️' },
  ],
};

export default function WorkflowDragDrop({ blocks = [], onUpdate, onConfigureBlock }) {
  const [blockLibraryOpen, setBlockLibraryOpen] = useState(false);

  const handleDragEnd = (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (type === 'LIBRARY') {
      // Adding new block from library
      const blockTemplate = Object.values(AVAILABLE_BLOCKS)
        .flat()
        .find(b => b.id === result.draggableId);

      if (blockTemplate) {
        const newBlock = {
          id: `block_${Date.now()}`,
          type: Object.keys(BLOCK_TYPES).find(k => Object.keys(AVAILABLE_BLOCKS[k]).includes(result.draggableId)),
          label: blockTemplate.label,
          templateId: blockTemplate.id,
          config: {},
        };
        const newBlocks = [...blocks];
        newBlocks.splice(destination.index, 0, newBlock);
        onUpdate(newBlocks);
      }
    } else {
      // Reordering existing blocks
      const newBlocks = Array.from(blocks);
      const [movedBlock] = newBlocks.splice(source.index, 1);
      newBlocks.splice(destination.index, 0, movedBlock);
      onUpdate(newBlocks);
    }
  };

  const removeBlock = (blockId) => {
    onUpdate(blocks.filter(b => b.id !== blockId));
  };

  return (
    <div className="flex gap-4">
      {/* Canvas */}
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-white mb-3">Workflow Canvas</h3>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="canvas" type="BLOCKS">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-96 p-4 rounded-lg border-2 border-dashed transition-colors ${
                  snapshot.isDraggingOver ? 'border-cyan-500/80 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/50'
                }`}
              >
                {blocks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <p className="text-sm mb-2">Drag blocks here to build your workflow</p>
                      <p className="text-xs text-slate-600">Start with a Trigger block</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blocks.map((block, index) => {
                      const blockType = BLOCK_TYPES[block.type];
                      return (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`p-3 rounded-lg border ${blockType.color} transition-all ${
                                snapshot.isDragging ? 'shadow-xl ring-2 ring-cyan-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div {...provided.dragHandleProps} className="text-slate-600 hover:text-slate-400">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <span className="text-lg">{blockType.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{block.label}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => onConfigureBlock(block.id)}
                                    className="p-1.5 hover:bg-blue-600/30 rounded text-blue-400 transition-colors"
                                    title="Configure"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => removeBlock(block.id)}
                                    className="p-1.5 hover:bg-red-600/30 rounded text-red-400 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Block Library */}
      <div className="w-64">
        <h3 className="text-sm font-semibold text-white mb-3">Block Library</h3>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="library" type="LIBRARY" isDropDisabled>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                {Object.entries(AVAILABLE_BLOCKS).map(([category, blocks]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{category}s</p>
                    <div className="space-y-2">
                      {blocks.map((block, idx) => (
                        <Draggable key={block.id} draggableId={block.id} index={idx}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-2.5 rounded-lg border bg-slate-800/50 border-slate-700 cursor-move transition-all text-xs hover:bg-slate-700/50 ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-cyan-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{block.icon}</span>
                                <span className="text-slate-300 truncate">{block.label}</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}