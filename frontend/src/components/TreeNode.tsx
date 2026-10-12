"use client";

import { useEffect, useRef } from "react";
import { ReportDetailNode } from "@/types";
import { ChevronRight, ChevronDown, Plus, CornerDownRight, Trash2 } from "lucide-react";

interface TreeNodeProps {
  node: ReportDetailNode;
  activeId: number | null;
  onSelect: (node: ReportDetailNode) => void;
  onAddChild: (parentId: number) => void;
  onAddSibling?: (parentId: number | null) => void;
  onDelete: (node: ReportDetailNode) => void;
  depth?: number;
  expandedMap: Record<number, boolean>;
  toggleExpand: (id: number) => void;
}

export function TreeNode({
  node,
  activeId,
  onSelect,
  onAddChild,
  onAddSibling,
  onDelete,
  depth = 0,
  expandedMap,
  toggleExpand,
}: TreeNodeProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedMap[node.id] ?? true;
  const isActive = activeId === node.id;

  // When active item changes, ensure it is visible in the outline scroll
  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isActive]);

  return (
    <div className="relative select-none text-xs group" id={`outline-item-${node.id}`}>
      {/* Node Row */}
      <div
        ref={itemRef}
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150 ${
          isActive
            ? "bg-blue-600/15 text-white font-medium border-l-2 border-blue-500"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border-l-2 border-transparent"
        }`}
        style={{ paddingLeft: `${Math.max(6, depth * 12 + 6)}px` }}
        onClick={() => onSelect(node)}
      >
        <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-1">
          {/* Chevron */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 rounded text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0 cursor-pointer"
              title={isExpanded ? "접기" : "펼치기"}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-400" />
              )}
            </button>
          ) : (
            <span className="w-3 inline-block text-slate-600 text-center text-[10px]">
              •
            </span>
          )}

          {/* Title */}
          <span className={`truncate text-xs ${isActive ? "text-white font-medium" : "text-slate-300"}`}>
            {node.title}
          </span>
        </div>

        {/* Hover Quick Actions */}
        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onAddSibling && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSibling(node.parent_id);
              }}
              className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer"
              title="동일 레벨 항목 추가"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer"
            title="하위 항목 추가"
          >
            <CornerDownRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node);
            }}
            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
            title="삭제"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-1 w-px bg-white/[0.06]"
            style={{ left: `${depth * 12 + 10}px` }}
          />
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                activeId={activeId}
                onSelect={onSelect}
                onAddChild={onAddChild}
                onAddSibling={onAddSibling}
                onDelete={onDelete}
                depth={depth + 1}
                expandedMap={expandedMap}
                toggleExpand={toggleExpand}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
