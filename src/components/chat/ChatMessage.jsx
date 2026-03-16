import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FunctionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  const name = toolCall?.name || 'Function';
  const status = toolCall?.status || 'pending';
  const results = toolCall?.results;

  const parsedResults = (() => {
    if (!results) return null;
    try { return typeof results === 'string' ? JSON.parse(results) : results; } catch { return results; }
  })();

  const isError = results && (
    (typeof results === 'string' && /error|failed/i.test(results)) ||
    (parsedResults?.success === false)
  );

  const statusConfig = {
    pending: { icon: Clock, color: 'text-slate-500', text: 'Pending' },
    running: { icon: Loader2, color: 'text-amber-400', text: 'Running...', spin: true },
    in_progress: { icon: Loader2, color: 'text-amber-400', text: 'Running...', spin: true },
    completed: isError ?
      { icon: AlertCircle, color: 'text-red-400', text: 'Failed' } :
      { icon: CheckCircle2, color: 'text-emerald-400', text: 'Success' },
    success: { icon: CheckCircle2, color: 'text-emerald-400', text: 'Success' },
    failed: { icon: AlertCircle, color: 'text-red-400', text: 'Failed' },
    error: { icon: AlertCircle, color: 'text-red-400', text: 'Failed' }
  }[status] || { icon: Zap, color: 'text-slate-500', text: '' };

  const Icon = statusConfig.icon;
  const formattedName = name.split('.').reverse().join(' ').toLowerCase();

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
          "hover:bg-slate-800/50",
          expanded ? "bg-slate-800/50 border-slate-600" : "bg-slate-900 border-slate-700"
        )}
      >
        <Icon className={cn("h-3 w-3", statusConfig.color, statusConfig.spin && "animate-spin")} />
        <span className="text-slate-300">{formattedName}</span>
        {statusConfig.text && (
          <span className={cn("text-slate-500", isError && "text-red-400")}>• {statusConfig.text}</span>
        )}
        {!statusConfig.spin && (toolCall.arguments_string || results) && (
          <ChevronRight className={cn("h-3 w-3 text-slate-500 transition-transform ml-auto", expanded && "rotate-90")} />
        )}
      </button>

      {expanded && !statusConfig.spin && (
        <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-700 space-y-2">
          {toolCall.arguments_string && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Parameters:</div>
              <pre className="bg-slate-950 rounded-md p-2 text-xs text-slate-400 whitespace-pre-wrap overflow-x-auto">
                {(() => { try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); } catch { return toolCall.arguments_string; } })()}
              </pre>
            </div>
          )}
          {parsedResults && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Result:</div>
              <pre className="bg-slate-950 rounded-md p-2 text-xs text-slate-400 whitespace-pre-wrap max-h-48 overflow-auto">
                {typeof parsedResults === 'object' ? JSON.stringify(parsedResults, null, 2) : parsedResults}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 flex items-center justify-center mt-0.5 shrink-0">
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
        </div>
      )}
      <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div className={cn(
            "rounded-2xl px-4 py-2.5",
            isUser ? "bg-slate-700 text-white" : "bg-slate-900/80 border border-slate-800 text-slate-200"
          )}>
            {isUser ? (
              <p className="text-sm leading-relaxed">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  p: ({ children }) => <p className="my-1 leading-relaxed text-slate-200">{children}</p>,
                  strong: ({ children }) => <strong className="text-emerald-400 font-semibold">{children}</strong>,
                  ul: ({ children }) => <ul className="my-1 ml-4 list-disc text-slate-300">{children}</ul>,
                  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal text-slate-300">{children}</ol>,
                  li: ({ children }) => <li className="my-0.5">{children}</li>,
                  h1: ({ children }) => <h1 className="text-lg font-semibold my-2 text-white">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold my-2 text-white">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold my-2 text-white">{children}</h3>,
                  code: ({ inline, children, ...props }) => inline ? (
                    <code className="px-1 py-0.5 rounded bg-slate-800 text-emerald-300 text-xs">{children}</code>
                  ) : (
                    <pre className="bg-slate-950 rounded-lg p-3 overflow-x-auto my-2">
                      <code {...props}>{children}</code>
                    </pre>
                  ),
                  a: ({ children, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">{children}</a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {message.tool_calls?.length > 0 && (
          <div className="space-y-1 mt-1">
            {message.tool_calls.map((toolCall, idx) => (
              <FunctionDisplay key={idx} toolCall={toolCall} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}