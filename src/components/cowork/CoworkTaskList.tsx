import React from 'react';
import { Plus, X } from 'lucide-react';
import { CoworkTaskListProps } from './types';

export const CoworkTaskList: React.FC<CoworkTaskListProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onNewTaskClick,
  workspace,
  isTasksOpen,
  onCloseTasks,
}) => {
  return (
    <>
      {isTasksOpen && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-2xs z-30 xl:hidden"
          onClick={onCloseTasks}
        />
      )}
      <div
        className={`${
          isTasksOpen
            ? 'fixed inset-y-0 left-0 z-40 xl:static flex'
            : 'hidden xl:flex'
        } w-72 md:w-80 border-r border-[#EBE7DF] bg-[#FAF8F5] flex-col shrink-0 overflow-hidden shadow-xl xl:shadow-none animate-in slide-in-from-left duration-200`}
      >
        {/* + New task Button */}
        <div className="p-3 border-b border-[#EBE7DF] bg-[#FCFAF7] shrink-0 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onNewTaskClick}
            className="flex-1 flex items-center gap-2 px-3 py-2 bg-white hover:bg-[#FFF7ED] text-slate-800 hover:text-[#EA580C] border border-[#E5E0D8] hover:border-[#FED7AA] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          >
            <div className="w-5 h-5 rounded-lg bg-slate-100 group-hover:bg-[#FFF7ED] flex items-center justify-center text-slate-600 group-hover:text-[#EA580C] transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <span>New task</span>
          </button>
          <button
            type="button"
            onClick={onCloseTasks}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer xl:hidden"
            title="Close tasks"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
          {tasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            const completedCount = task.steps?.filter((s) => s.status === 'completed').length || 0;
            const totalCount = task.steps?.length || 0;

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task.id)}
                className={`w-full p-2.5 rounded-xl text-left transition-all cursor-pointer flex items-start justify-between gap-2 border ${
                  isSelected
                    ? 'bg-white border-[#E5E0D8] shadow-xs'
                    : 'hover:bg-white/70 border-transparent hover:border-[#E5E0D8]/60 text-slate-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-900 truncate leading-tight">
                    {task.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                    {task.status === 'completed' ? (
                      <span className="text-emerald-700 font-sans font-medium">Finished · Verified</span>
                    ) : task.status === 'awaiting_approval' ? (
                      <span className="text-amber-700 font-sans font-semibold">Needs human approval</span>
                    ) : totalCount > 0 ? (
                      <span>Step {completedCount + 1} of {totalCount}</span>
                    ) : (
                      <span>Autonomous Task</span>
                    )}
                  </p>
                </div>

                {/* Status Indicator Dot */}
                <div className="shrink-0 mt-1">
                  {task.status === 'completed' ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Completed" />
                  ) : task.status === 'awaiting_approval' ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" title="Needs Approval" />
                  ) : task.status === 'running' ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#EA580C] animate-ping" title="Running" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" title="Ready" />
                  )}
                </div>
              </button>
            );
          })}

          {tasks.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              No tasks yet. Click "+ New task" above.
            </div>
          )}
        </div>

        {/* User profile footer */}
        <div className="p-3 border-t border-[#EBE7DF] bg-[#FCFAF7] flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-xs font-bold text-[#EA580C]">
            C
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate">Developer Workspace</div>
            <div className="text-[10px] text-slate-400 font-mono truncate">{workspace?.name || 'Cortex AI'}</div>
          </div>
        </div>
      </div>
    </>
  );
};
