/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Check,
  Coffee,
  Dices,
  Trophy,
  UtensilsCrossed,
  Sparkles,
  Palette,
  Utensils,
  Stethoscope,
  Trash2,
  Dumbbell,
  Dog,
  CalendarDays,
  List,
  Sparkle,
} from 'lucide-react';
import {
  MONTHLY_ACTIVITIES_LIST,
  getMonthlyCalendarEvents,
  type MonthlyRecurringEvent,
} from '../data/monthlyActivities';
import type { TaskItem } from '../types';

interface MonthlyActivityReminderProps {
  todayStr: string;
  tasks?: TaskItem[];
  onAddTask?: (taskText: string, dateStr: string) => void;
  onRemoveTask?: (taskText: string, dateStr: string) => void;
  onShowToast?: (message: string) => void;
}

export function MonthlyActivityReminder({
  todayStr,
  tasks,
  onAddTask,
  onRemoveTask,
  onShowToast,
}: MonthlyActivityReminderProps) {
  // Parse initial current date
  const todayDate = useMemo(() => {
    const parts = todayStr.split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  }, [todayStr]);

  const [viewDate, setViewDate] = useState<Date>(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  );

  const [selectedDay, setSelectedDay] = useState<number>(todayDate.getDate());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [addedTasks, setAddedTasks] = useState<Record<string, boolean>>({});

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth(); // 0-indexed

  // Month navigation
  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDay(1);
  };

  const handleTodayJump = () => {
    setViewDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
    setSelectedDay(todayDate.getDate());
  };

  // Month information
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long' });
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  // Calculate events for current month
  const monthlyEventsMap = useMemo(() => {
    return getMonthlyCalendarEvents(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Selected date object & formatted strings
  const selectedDateObj = useMemo(() => {
    return new Date(currentYear, currentMonth, selectedDay);
  }, [currentYear, currentMonth, selectedDay]);

  const selectedDateStr = useMemo(() => {
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(selectedDay).padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  }, [currentYear, currentMonth, selectedDay]);

  const selectedDayEvents = useMemo(() => {
    return monthlyEventsMap[selectedDay] || [];
  }, [monthlyEventsMap, selectedDay]);

  // Is viewing current month & year
  const isCurrentMonth =
    todayDate.getFullYear() === currentYear &&
    todayDate.getMonth() === currentMonth;

  // Check if an event is in the checklist for a given date
  const isEventInChecklist = (event: MonthlyRecurringEvent, dateStr: string) => {
    const taskKey = `${dateStr}-${event.id}`;
    if (tasks) {
      const baseTitle = event.title.trim().toLowerCase();
      return tasks.some(
        (t) =>
          t.date === dateStr &&
          (t.text.trim().toLowerCase() === `${event.title} (${event.time})`.toLowerCase() ||
            t.text.trim().toLowerCase().startsWith(baseTitle))
      );
    }
    return !!addedTasks[taskKey];
  };

  // Toggle event in checklist (adds or undoes/removes)
  const handleToggleChecklist = (
    event: MonthlyRecurringEvent,
    targetDateStr = selectedDateStr
  ) => {
    const taskKey = `${targetDateStr}-${event.id}`;
    const taskTitle = `${event.title} (${event.time})`;
    const isAlreadyAdded = isEventInChecklist(event, targetDateStr);

    if (isAlreadyAdded) {
      if (onRemoveTask) {
        onRemoveTask(taskTitle, targetDateStr);
      }
      setAddedTasks((prev) => {
        const next = { ...prev };
        delete next[taskKey];
        return next;
      });
      if (onShowToast) {
        onShowToast(`Removed "${event.title}" from Daily Checklist.`);
      }
    } else {
      if (onAddTask) {
        onAddTask(taskTitle, targetDateStr);
      }
      setAddedTasks((prev) => ({ ...prev, [taskKey]: true }));
      if (onShowToast) {
        onShowToast(`Added "${event.title}" to your Daily Checklist for ${targetDateStr}`);
      }
    }
  };

  // Render event icon
  const renderEventIcon = (iconType: MonthlyRecurringEvent['iconType'], className = 'w-4 h-4') => {
    switch (iconType) {
      case 'trash':
        return <Trash2 className={className} />;
      case 'exercise':
        return <Dumbbell className={className} />;
      case 'puppy':
        return <Dog className={className} />;
      case 'coffee':
        return <Coffee className={className} />;
      case 'game':
        return <Dices className={className} />;
      case 'bowling':
        return <Trophy className={className} />;
      case 'potluck':
        return <UtensilsCrossed className={className} />;
      case 'bingo':
        return <Sparkles className={className} />;
      case 'crafts':
        return <Palette className={className} />;
      case 'lunch':
        return <Utensils className={className} />;
      case 'doctor':
        return <Stethoscope className={className} />;
      default:
        return <Sparkle className={className} />;
    }
  };

  // Filtered recurring rules for list view
  const filteredRecurringList = useMemo(() => {
    if (categoryFilter === 'all') return MONTHLY_ACTIVITIES_LIST;
    return MONTHLY_ACTIVITIES_LIST.filter((item) => item.category === categoryFilter);
  }, [categoryFilter]);

  return (
    <div className="bg-gradient-to-br from-[#f0f6fc] to-[#e1edf8] dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-950/90 border border-[#bcd6ee] dark:border-slate-800 rounded-[30px] p-5 shadow-sm transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#026aa7] dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Monthly Activity Reminder
            </h2>
          </div>
          <p className="text-[11px] font-semibold text-[#026aa7]/80 dark:text-blue-300/80 mt-0.5">
            Recurring monthly gatherings, health visits & weekly routines
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-white/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-[#bcd6ee] dark:border-slate-700 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-[#026aa7] text-white shadow-xs'
                : 'text-stone-600 dark:text-slate-300 hover:text-[#026aa7]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[#026aa7] text-white shadow-xs'
                : 'text-stone-600 dark:text-slate-300 hover:text-[#026aa7]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>All Activities</span>
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <>
          {/* Month Navigation Toolbar */}
          <div className="bg-white/95 dark:bg-slate-900/80 rounded-2xl p-2.5 mb-3.5 border border-[#cfe1f2] dark:border-slate-800 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-xl hover:bg-[#e3eef8] dark:hover:bg-slate-800 text-[#026aa7] dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-xl hover:bg-[#e3eef8] dark:hover:bg-slate-800 text-[#026aa7] dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center">
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {monthName} {currentYear}
              </span>
            </div>

            <button
              type="button"
              onClick={handleTodayJump}
              className={`text-xs font-bold px-2.5 py-1 rounded-xl transition border cursor-pointer ${
                isCurrentMonth && selectedDay === todayDate.getDate()
                  ? 'bg-[#026aa7] text-white border-[#026aa7] shadow-xs'
                  : 'bg-[#e3eef8] dark:bg-slate-800 text-[#026aa7] dark:text-blue-200 border-[#bcd6ee] dark:border-slate-700 hover:bg-[#d0e4f5]'
              }`}
            >
              Today
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white/95 dark:bg-slate-900/80 rounded-2xl p-3 border border-[#cfe1f2] dark:border-slate-800 mb-3.5 shadow-2xs">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                <div
                  key={d}
                  className={`text-[11px] font-bold py-1 ${
                    i === 0 || i === 6
                      ? 'text-stone-400 dark:text-slate-500'
                      : 'text-stone-700 dark:text-slate-300'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Padding for starting day */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10 rounded-xl bg-transparent" />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const events = monthlyEventsMap[day] || [];
                const hasEvents = events.length > 0;
                const isSelected = selectedDay === day;
                const isToday =
                  isCurrentMonth && day === todayDate.getDate();

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`h-10 rounded-xl relative flex flex-col items-center justify-between py-1 px-0.5 transition cursor-pointer text-xs font-semibold ${
                      isSelected
                        ? 'bg-[#026aa7] text-white font-extrabold shadow-sm scale-105 z-10'
                        : isToday
                          ? 'bg-[#e3eef8] dark:bg-blue-950/60 text-[#026aa7] dark:text-blue-200 border border-[#bcd6ee] dark:border-blue-700'
                          : hasEvents
                            ? 'hover:bg-[#f0f6fc] dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold'
                            : 'hover:bg-stone-50 dark:hover:bg-slate-800 text-stone-500 dark:text-slate-400'
                    }`}
                  >
                    <span>{day}</span>

                    {/* Activity Indicator Dots / Badge */}
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      {hasEvents && (
                        <>
                          {events.slice(0, 3).map((ev, idx) => (
                            <span
                              key={idx}
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected
                                  ? 'bg-white'
                                  : ev.category === 'health'
                                    ? 'bg-blue-600'
                                    : ev.category === 'wellness'
                                      ? 'bg-emerald-600'
                                      : ev.category === 'dining'
                                        ? 'bg-rose-600'
                                        : ev.category === 'creative'
                                          ? 'bg-pink-600'
                                          : ev.category === 'service'
                                            ? 'bg-amber-600'
                                            : 'bg-indigo-600'
                              }`}
                            />
                          ))}
                          {events.length > 3 && (
                            <span
                              className={`text-[8px] leading-none ${
                                isSelected ? 'text-white' : 'text-stone-500'
                              }`}
                            >
                              +
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Activity List */}
          <div className="bg-white/95 dark:bg-slate-900/80 rounded-2xl p-3.5 border border-[#cfe1f2] dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#026aa7]"></div>
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  {selectedDateObj.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[#026aa7] dark:text-blue-300 bg-[#e3eef8] dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-[#bcd6ee] dark:border-blue-800">
                {selectedDayEvents.length}{' '}
                {selectedDayEvents.length === 1 ? 'Activity' : 'Activities'}
              </span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs font-semibold text-stone-400 dark:text-slate-500">
                  No recurring activities scheduled for this date.
                </p>
                <p className="text-[10px] text-stone-400 dark:text-slate-500 mt-0.5">
                  Select a day with color dots to see reminders and routines.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((event) => {
                  const isAlreadyAdded = isEventInChecklist(event, selectedDateStr);

                  return (
                    <div
                      key={event.id}
                      className="bg-[#f4f9fd] dark:bg-slate-800/70 rounded-2xl p-3.5 sm:p-4 border border-[#cfe1f2] dark:border-slate-700/80 flex flex-col gap-2.5 hover:border-[#bcd6ee] dark:hover:border-slate-600 transition shadow-2xs"
                    >
                      {/* Top Header: Category Icon & Title */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0 flex items-center justify-center border ${event.badgeBg} ${event.badgeText} ${event.badgeBorder} shadow-2xs`}
                        >
                          {renderEventIcon(event.iconType, 'w-4 h-4 sm:w-5 sm:h-5')}
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {event.title}
                        </h4>
                      </div>

                      {/* Resorted Metadata Badges: Schedule, Time, and Location */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Schedule / Recurrence Tag */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${event.badgeBg} ${event.badgeText} ${event.badgeBorder}`}
                          >
                            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                            <span>{event.recurrenceLabel}</span>
                          </span>

                          {/* Time Chip */}
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#e3eef8] dark:bg-slate-700 text-[#026aa7] dark:text-blue-200 border border-[#bcd6ee] dark:border-slate-600">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-[#026aa7] dark:text-blue-400" />
                            <span>{event.time}</span>
                          </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium pl-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                          <span>{event.location}</span>
                        </div>
                      </div>

                      {/* Description Box: Clear, spacious, and readable */}
                      <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-2.5 sm:p-3 border border-[#e1edf8] dark:border-slate-700">
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                          {event.description}
                        </p>
                      </div>

                      {/* Action Button: Full width on mobile, right-aligned on desktop - Tap to Add or Tap to Undo/Remove */}
                      <div className="pt-0.5 flex sm:justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(event, selectedDateStr)}
                          className={`w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98 ${
                            isAlreadyAdded
                              ? 'bg-emerald-100 hover:bg-rose-50 text-emerald-800 hover:text-rose-700 border border-emerald-300 hover:border-rose-300 dark:bg-emerald-950/60 dark:hover:bg-rose-950/40 dark:text-emerald-300 dark:hover:text-rose-300 dark:border-emerald-700 dark:hover:border-rose-700'
                              : 'bg-[#e3eef8] hover:bg-[#d0e4f5] text-[#026aa7] border border-[#bcd6ee] dark:bg-slate-700 dark:text-blue-200 dark:border-slate-600'
                          }`}
                          title={
                            isAlreadyAdded
                              ? 'Tap to undo and remove from Daily Checklist'
                              : 'Add this activity to your Daily Checklist'
                          }
                        >
                          {isAlreadyAdded ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
                              <span>Added to Checklist (Tap to Remove)</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 text-[#026aa7] dark:text-blue-400 stroke-[2.5]" />
                              <span>Add to Daily Checklist</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* List Mode: Complete Recurring Rule Book */
        <div className="space-y-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 text-xs font-semibold">
            {[
              { id: 'all', label: 'All Activities' },
              { id: 'wellness', label: 'Wellness' },
              { id: 'social', label: 'Social & Fun' },
              { id: 'dining', label: 'Dining' },
              { id: 'creative', label: 'Creative' },
              { id: 'games', label: 'Games' },
              { id: 'health', label: 'Health' },
              { id: 'service', label: 'Services' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[#026aa7] text-white shadow-xs'
                    : 'bg-white/90 dark:bg-slate-800 text-stone-700 dark:text-slate-300 hover:bg-[#e3eef8] border border-[#bcd6ee] dark:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredRecurringList.map((item) => (
              <div
                key={item.id}
                className="bg-white/95 dark:bg-slate-900/80 p-3.5 sm:p-4 rounded-2xl border border-[#cfe1f2] dark:border-slate-800 flex flex-col gap-2.5 shadow-2xs hover:border-[#bcd6ee] dark:hover:border-slate-700 transition"
              >
                {/* Top Header: Category Icon & Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0 flex items-center justify-center border ${item.badgeBg} ${item.badgeText} ${item.badgeBorder} shadow-2xs`}
                  >
                    {renderEventIcon(item.iconType, 'w-4 h-4 sm:w-5 sm:h-5')}
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {item.title}
                  </h4>
                </div>

                {/* Resorted Metadata Badges: Schedule, Time, Location */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Schedule / Recurrence Tag */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${item.badgeBg} ${item.badgeText} ${item.badgeBorder}`}
                    >
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.recurrenceLabel}</span>
                    </span>

                    {/* Time Chip */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#e3eef8] dark:bg-slate-800 text-[#026aa7] dark:text-blue-200 border border-[#bcd6ee] dark:border-slate-700">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-[#026aa7] dark:text-blue-400" />
                      <span>{item.time}</span>
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium pl-0.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                    <span>{item.location}</span>
                  </div>
                </div>

                {/* Description Box */}
                <div className="bg-[#f8fbfd] dark:bg-slate-800/60 rounded-xl p-2.5 sm:p-3 border border-[#e1edf8] dark:border-slate-700/80">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>

                {/* Action Button: Full width on mobile, right-aligned on desktop */}
                {(() => {
                  const isAddedToday = isEventInChecklist(item, todayStr);
                  return (
                    <div className="pt-0.5 flex sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(item, todayStr)}
                        className={`w-full sm:w-auto min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98 ${
                          isAddedToday
                            ? 'bg-emerald-100 hover:bg-rose-50 text-emerald-800 hover:text-rose-700 border border-emerald-300 hover:border-rose-300 dark:bg-emerald-950/60 dark:hover:bg-rose-950/40 dark:text-emerald-300 dark:hover:text-rose-300 dark:border-emerald-700 dark:hover:border-rose-700'
                            : 'bg-[#e3eef8] hover:bg-[#d0e4f5] text-[#026aa7] border border-[#bcd6ee] dark:bg-slate-700 dark:text-blue-200 dark:border-slate-600'
                        }`}
                        title={
                          isAddedToday
                            ? "Tap to remove from Today's Checklist"
                            : "Add to Today's Checklist"
                        }
                      >
                        {isAddedToday ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
                            <span>Added Today (Tap to Remove)</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-[#026aa7] dark:text-blue-400 stroke-[2.5]" />
                            <span>Add to Today's Checklist</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
