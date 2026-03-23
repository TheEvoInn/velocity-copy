import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, GripVertical, Trash2, Settings } from 'lucide-react';

const BLOCK_TYPES = {
  trigger:   { label: 'Trigger',   icon: '🔔', color: 'bg-blue-900/30 border-blue-500/50' },
  condition: { label: 'Condition', icon: '❓', color: 'bg-purple-900/30 border-purple-500/50' },
  action:    { label: 'Action',    icon: '⚡', color: 'bg-emerald-900/30 border-emerald-500/50' },
  delay:     { label: 'Delay',     icon: '⏱️', color: 'bg-amber-900/30 border-amber-500/50' },
  filter:    { label: 'Filter',    icon: '🔍', color: 'bg-cyan-900/30 border-cyan-500/50' },
};

const LIBRARY_BLOCKS = [
  { id: 'trigger_scan',     type: 'trigger',   label: 'Scan for opportunities', icon: '🔍' },
  { id: 'trigger_schedule', type: 'trigger',   label: 'Scheduled time',         icon: '⏰' },
  { id: 'action_queue',     type: 'action',    label: 'Queue task',             icon: '📋' },
  { id: 'action_alert',     type: 'action',    label: 'Send alert',             icon: '🔔' },
  { id: 'action_email',     type: 'action',    label: 'Send email',             icon: '✉️' },
  { id: 'cond_value',       type: 'condition', label: 'Value check',            icon: '💰' },
  { id: 'cond_platform',    type: 'condition', label: 'Platform match',         icon: '🌐' },
  { id: 'delay_wait',       type: 'delay',     label: 'Wait time',              icon: '⏱️' },
];

export default function WorkflowDragDrop({ blocks = [], onUpdate, onConfigureBlock }) {

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    // Drag from library → canvas
    if (source.droppableId === 'library' && destination.droppableId === 'canvas') {
      const template = LIBRARY_BLOCKS.find(b => b.id === draggableId);
      if (!template) return;
      const newBlock = {
        id: `block_${Date.now()}`,
        type: template.type,
        label: template.label,
        templateId: template.id,
        config: {},
      };
      const newBlocks = [...blocks];
      newBlocks.splice(destination.index, 0, newBlock);
      onUpdate(newBlocks);
      return;
    }

    // Reorder within canvas
    if (source.droppableId === 'canvas' && destination.droppableId === 'canvas') {
      const newBlocks = Array.from(blocks);
      const [moved] = newBlocks.splice(source.index, 1);
      newBlocks.splice(destination.index, 0, moved);
      onUpdate(newBlocks);
    }
  };

  const removeBlock = (blockId) => {
    onUpdate(blocks.filter(b => b.id !== blockId));
  };

  // Group library blocks by type for display
  const grouped = LIBRARY_BLOCKS.reduce((acc, b) => {
    if (!acc[b.type]) acc[b.type] = [];
    acc[b.type].push(b);
    return acc;
  }, {});

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        {/* Canvas */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white mb-3">Workflow Canvas</h3>
          <Droppable droppableId="canvas">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-96 p-4 rounded-lg border-2 border-dashed transition-colors ${
                  snapshot.isDraggingOver
                    ? 'border-cyan-500/80 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-900/50'
                }`}
              >
                {blocks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 min-h-80">
                    <div className="text-center">
                      <p className="text-sm mb-2">Drag blocks here to build your workflow</p>
                      <p className="text-xs text-slate-600">Start with a Trigger block</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blocks.map((block, index) => {
                      const blockType = BLOCK_TYPES[block.type] || BLOCK_TYPES.action;
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
                                <div {...provided.dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab">
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
        </div>

        {/* Block Library */}
        <div className="w-56 shrink-0">
          <h3 className="text-sm font-semibold text-white mb-3">Block Library</h3>
          <Droppable droppableId="library" isDropDisabled>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{category}s</p>
                    <div className="space-y-1.5">
                      {items.map((block, idx) => (
                        <Draggable key={block.id} draggableId={block.id} index={idx}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-2.5 rounded-lg border bg-slate-800/50 border-slate-700 cursor-grab text-xs hover:bg-slate-700/50 transition-all ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-cyan-500 opacity-80' : ''
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
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  );
}