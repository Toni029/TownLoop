/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, useDragControls } from 'motion/react';
import type { HomeState } from '../../hooks/useHomeState';

type AddTaskModalProps = Pick<
  HomeState,
  | 'setIsAddTaskModalOpen'
  | 'handleAddTask'
  | 'newTaskText'
  | 'setNewTaskText'
  | 'newTaskDate'
  | 'setNewTaskDate'
>;

export function AddTaskModal({
  setIsAddTaskModalOpen,
  handleAddTask,
  newTaskText,
  setNewTaskText,
  newTaskDate,
  setNewTaskDate,
}: AddTaskModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const dragControls = useDragControls();

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsAddTaskModalOpen(false);
    }, 190);
  };

  return (
    <motion.div
      key="add-task-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="fixed inset-0 bg-stone-950/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleClose}
    >
      <motion.div
        key="add-task-sheet"
        drag={isClosing ? false : "y"}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.2, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info;
          if (offset.y > 60 || velocity.y > 250) {
            handleClose();
          }
        }}
        initial={{ y: '100%' }}
        animate={isClosing ? { y: '100%' } : { y: 0 }}
        exit={{ y: '100%' }}
        transition={
          isClosing
            ? { duration: 0.18, ease: [0.32, 0.72, 0, 1] }
            : {
                type: 'spring',
                damping: 28,
                stiffness: 450,
                mass: 0.35,
              }
        }
        onAnimationComplete={() => {
          if (isClosing) {
            setIsAddTaskModalOpen(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl space-y-4 border-t sm:border border-stone-200 will-change-transform"
      >
        {/* iOS pull/grab indicator bar */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          onClick={handleClose}
          style={{ touchAction: 'none' }}
          className="w-full py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing sm:hidden shrink-0 group select-none -mt-2 mb-1"
        >
          <div className="w-12 h-1.5 bg-stone-300 group-hover:bg-stone-400 rounded-full" />
        </div>

        <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
          <h3 className="text-base font-bold text-slate-800">Add New Task</h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-800 flex items-center justify-center font-bold cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleAddTask} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Task Description
            </label>
            <input
              required
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="e.g., Water porch plants"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-emerald-600"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Scheduled Date
            </label>
            <input
              type="date"
              required
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-emerald-600"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-sm transition mt-2 shadow-sm cursor-pointer"
          >
            Add to Checklist
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
