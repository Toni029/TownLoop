/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { motion, useDragControls } from 'motion/react';
import type { HomeState } from '../../hooks/useHomeState';
import type { PortalDatesState } from '../../hooks/usePortalDates';

type TaskCalendarModalProps = Pick<
  HomeState,
  | 'setCalendarViewDate'
  | 'calendarViewDate'
  | 'setIsCalendarModalOpen'
  | 'taskFilter'
  | 'selectedDate'
  | 'tasks'
  | 'setSelectedDate'
  | 'setTaskFilter'
> &
  Pick<PortalDatesState, 'monthNames' | 'tomorrowStr' | 'todayStr'>;

export function TaskCalendarModal({
  setCalendarViewDate,
  monthNames,
  calendarViewDate,
  setIsCalendarModalOpen,
  taskFilter,
  selectedDate,
  tomorrowStr,
  todayStr,
  tasks,
  setSelectedDate,
  setTaskFilter,
}: TaskCalendarModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const dragControls = useDragControls();

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsCalendarModalOpen(false);
    }, 220);
  };

  return (
    <motion.div
      key="task-calendar-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 bg-stone-950/65 backdrop-blur-xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleClose}
    >
      <motion.div
        key="task-calendar-modal"
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
            ? { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
            : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }
        }
        onAnimationComplete={() => {
          if (isClosing) {
            setIsCalendarModalOpen(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl space-y-4 border-t sm:border border-stone-200 dark:border-slate-800 gpu-layer antialiased [text-rendering:optimizeLegibility] overflow-hidden relative"
      >
        {/* Dynamic Specular Light Flare Sweep on open */}
        <motion.div
          initial={{ x: '-100%', opacity: 0.6 }}
          animate={{ x: '180%', opacity: 0 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="absolute inset-0 -skew-x-12 pointer-events-none z-10 bg-gradient-to-r from-transparent via-emerald-500/10 dark:via-white/10 to-transparent w-full h-full"
        />
        {/* iOS pull/grab indicator bar */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          onClick={handleClose}
          style={{ touchAction: 'none' }}
          className="w-full py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing sm:hidden shrink-0 group select-none -mt-2 mb-1"
        >
          <div className="w-12 h-1.5 bg-stone-300 dark:bg-slate-700 group-hover:bg-stone-400 rounded-full" />
        </div>

        {/* Header with Month Navigation */}
        <div className="flex justify-between items-center border-b border-neutral-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCalendarViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                );
              }}
              className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer border border-neutral-200 dark:border-slate-700"
              title="Previous month"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {monthNames[calendarViewDate.getMonth()]}{' '}
              {calendarViewDate.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() => {
                setCalendarViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                );
              }}
              className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer border border-neutral-200 dark:border-slate-700"
              title="Next month"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-slate-800 text-neutral-500 dark:text-slate-400 hover:text-neutral-800 dark:hover:text-slate-200 flex items-center justify-center font-bold cursor-pointer"
            title="Close calendar"
            aria-label="Close calendar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Day of Week Labels */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {(() => {
            const viewYear = calendarViewDate.getFullYear();
            const viewMonth = calendarViewDate.getMonth();
            const firstDay = new Date(viewYear, viewMonth, 1).getDay();
            const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
            const blanks = Array.from({ length: firstDay });
            const days = Array.from({ length: totalDays }, (_, i) => i + 1);

            const activeSelectedDateStr =
              taskFilter === 'date'
                ? selectedDate
                : taskFilter === 'tomorrow'
                  ? tomorrowStr
                  : todayStr;

            return (
              <>
                {blanks.map((_, idx) => (
                  <div key={`blank-${idx}`} className="h-10" />
                ))}
                {days.map((d) => {
                  const monthPadded = String(viewMonth + 1).padStart(2, '0');
                  const dayPadded = String(d).padStart(2, '0');
                  const cellDateStr = `${viewYear}-${monthPadded}-${dayPadded}`;
                  const isRealToday = cellDateStr === todayStr;
                  const isSelectedDay = cellDateStr === activeSelectedDateStr;
                  const dayTasks = tasks.filter((t) => t.date === cellDateStr);
                  const hasTasks = dayTasks.length > 0;

                  return (
                    <button
                      key={`day-${cellDateStr}`}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cellDateStr);
                        if (cellDateStr === todayStr) {
                          setTaskFilter('today');
                        } else if (cellDateStr === tomorrowStr) {
                          setTaskFilter('tomorrow');
                        } else {
                          setTaskFilter('date');
                        }
                        setIsCalendarModalOpen(false);
                      }}
                      className={`h-10 rounded-xl font-bold transition flex flex-col items-center justify-center relative cursor-pointer ${
                        isSelectedDay
                          ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-600/30'
                          : isRealToday
                            ? 'border-2 border-emerald-600 text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                            : 'hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                      title={`${cellDateStr}${hasTasks ? ` (${dayTasks.length} tasks)` : ''}`}
                    >
                      <span>{d}</span>
                      {hasTasks && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                            isSelectedDay ? 'bg-white' : 'bg-emerald-600'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* Footer Controls: Jump to Today & Info */}
        <div className="pt-2 border-t border-neutral-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayStr);
              setTaskFilter('today');
              setCalendarViewDate(new Date());
              setIsCalendarModalOpen(false);
            }}
            className="text-emerald-800 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-300 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Jump to Today</span>
          </button>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Tap any day to view or schedule
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
