/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { Calendar, CheckCircle2, Plus, X, Trash2 } from 'lucide-react';
import { WeatherWidget } from '../components/WeatherWidget';
import { MonthlyActivityReminder } from '../components/MonthlyActivityReminder';
import { DailyMedications } from '../components/DailyMedications';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { HomeState } from '../hooks/useHomeState';
import type { PortalDatesState } from '../hooks/usePortalDates';

type HomeScreenProps = Pick<
  HomeState,
  | 'tasks'
  | 'taskFilter'
  | 'formatFriendlyDate'
  | 'selectedDate'
  | 'doneCount'
  | 'filteredTasks'
  | 'setCalendarViewDate'
  | 'setIsCalendarModalOpen'
  | 'setNewTaskDate'
  | 'setIsAddTaskModalOpen'
  | 'setTaskFilter'
  | 'toggleTask'
  | 'deleteTask'
  | 'addDirectTask'
  | 'removeDirectTask'
> &
  Pick<PortalDatesState, 'todayStr' | 'tomorrowStr'> & {
    onShowToast?: (message: string) => void;
  };

export function HomeScreen({
  tasks,
  taskFilter,
  formatFriendlyDate,
  todayStr,
  tomorrowStr,
  selectedDate,
  doneCount,
  filteredTasks,
  setCalendarViewDate,
  setIsCalendarModalOpen,
  setNewTaskDate,
  setIsAddTaskModalOpen,
  setTaskFilter,
  toggleTask,
  deleteTask,
  addDirectTask,
  removeDirectTask,
  onShowToast,
}: HomeScreenProps) {
  return (
    <section className="space-y-4 animate-in fade-in duration-200">
      {/* iPhone-style Animated Weather Card */}
      <ErrorBoundary viewName="Weather Widget">
        <WeatherWidget />
      </ErrorBoundary>

      {/* Daily Medications Reminder */}
      <ErrorBoundary viewName="Daily Medications">
        <DailyMedications todayStr={todayStr} onShowToast={onShowToast} />
      </ErrorBoundary>

      {/* Daily Checklist Tile */}
      <ErrorBoundary viewName="Daily Checklist">
        <div className="bg-gradient-to-br from-[#f2f7f4] to-[#e8f1ec] border border-emerald-200/60 rounded-[30px] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Daily Checklist
                </h2>
                <p className="text-[11px] font-semibold text-emerald-800">
                  {taskFilter === 'today' &&
                    `Today • ${formatFriendlyDate(todayStr)}`}
                  {taskFilter === 'tomorrow' &&
                    `Tomorrow • ${formatFriendlyDate(tomorrowStr)}`}
                  {taskFilter === 'date' && `${formatFriendlyDate(selectedDate)}`}
                  {taskFilter === 'all' && 'All Scheduled Tasks'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                {doneCount}/{filteredTasks.length} Done
              </span>
              <button
                onClick={() => {
                  const target = taskFilter === 'date' ? selectedDate : todayStr;
                  const [y, m, d] = target.split('-').map(Number);
                  setCalendarViewDate(new Date(y, (m || 1) - 1, d || 1));
                  setIsCalendarModalOpen(true);
                }}
                title="Choose Date on Calendar"
                className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-emerald-800 border border-emerald-200 flex items-center justify-center transition shadow-xs cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const targetDate =
                    taskFilter === 'date'
                      ? selectedDate
                      : taskFilter === 'tomorrow'
                        ? tomorrowStr
                        : todayStr;
                  setNewTaskDate(targetDate);
                  setIsAddTaskModalOpen(true);
                }}
                title="Add Task"
                className="w-8 h-8 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center transition shadow-sm font-bold text-base cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 mb-3 text-xs font-semibold">
            <button
              onClick={() => setTaskFilter('today')}
              className={`px-3 py-1 rounded-full transition cursor-pointer ${
                taskFilter === 'today'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white/80 text-slate-700 hover:bg-white border border-emerald-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTaskFilter('tomorrow')}
              className={`px-3 py-1 rounded-full transition cursor-pointer ${
                taskFilter === 'tomorrow'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white/80 text-slate-700 hover:bg-white border border-emerald-100'
              }`}
            >
              Tomorrow
            </button>
            {taskFilter === 'date' &&
              selectedDate !== todayStr &&
              selectedDate !== tomorrowStr && (
                <div className="flex items-center bg-emerald-700 text-white px-3 py-1 rounded-full shadow-xs gap-1.5">
                  <Calendar className="w-3 h-3 text-emerald-200" />
                  <span>{formatFriendlyDate(selectedDate)}</span>
                  <button
                    type="button"
                    onClick={() => setTaskFilter('today')}
                    className="hover:text-emerald-200 cursor-pointer ml-0.5"
                    title="Back to Today"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            <button
              onClick={() => {
                const target = taskFilter === 'date' ? selectedDate : todayStr;
                const [y, m, d] = target.split('-').map(Number);
                setCalendarViewDate(new Date(y, (m || 1) - 1, d || 1));
                setIsCalendarModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-full transition cursor-pointer bg-white/80 text-emerald-800 hover:bg-white border border-emerald-200 flex items-center gap-1"
              title="Pick another day from calendar"
            >
              <Calendar className="w-3 h-3" />
              <span>Choose Day</span>
            </button>
            <button
              onClick={() => setTaskFilter('all')}
              className={`px-3 py-1 rounded-full transition cursor-pointer ${
                taskFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white/80 text-slate-700 hover:bg-white border border-emerald-100'
              }`}
            >
              All Tasks
            </button>
          </div>

          <div className="space-y-2 text-sm">
            {filteredTasks.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">
                No tasks scheduled for this day.
              </div>
            ) : (
              filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2.5 bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 p-3 rounded-2xl border border-emerald-100/80 dark:border-slate-700 shadow-xs transition"
                >
                  {/* Task Checkbox & Label */}
                  <label className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => toggleTask(t.id)}
                      className="w-4 h-4 accent-emerald-700 rounded cursor-pointer shrink-0"
                    />
                    <span
                      className={`font-medium text-xs leading-snug break-words ${
                        t.done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {t.text}
                    </span>
                  </label>

                  {/* Date badge & Trashcan Button on the right */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                      {t.date}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(t.id);
                        onShowToast?.(`Removed "${t.text}" from checklist.`);
                      }}
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 dark:text-slate-500 dark:hover:text-rose-400 transition flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
                      title="Remove task"
                      aria-label={`Remove task ${t.text}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ErrorBoundary>

      {/* Monthly Activity Reminder Tile */}
      <ErrorBoundary viewName="Monthly Activities">
        <MonthlyActivityReminder
          todayStr={todayStr}
          tasks={tasks}
          onAddTask={addDirectTask}
          onRemoveTask={removeDirectTask}
          onShowToast={onShowToast}
        />
      </ErrorBoundary>
    </section>
  );
}
