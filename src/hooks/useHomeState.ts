import type React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { TaskItem } from '../types';

const STORAGE_KEY = 'portal_tasks_list';

export interface HomeState {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  taskFilter: 'today' | 'tomorrow' | 'date' | 'all';
  setTaskFilter: React.Dispatch<React.SetStateAction<'today' | 'tomorrow' | 'date' | 'all'>>;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  isAddTaskModalOpen: boolean;
  setIsAddTaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newTaskText: string;
  setNewTaskText: React.Dispatch<React.SetStateAction<string>>;
  newTaskDate: string;
  setNewTaskDate: React.Dispatch<React.SetStateAction<string>>;
  isCalendarModalOpen: boolean;
  setIsCalendarModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  calendarViewDate: Date;
  setCalendarViewDate: React.Dispatch<React.SetStateAction<Date>>;
  formatFriendlyDate: (dateStr: string) => string;
  doneCount: number;
  filteredTasks: TaskItem[];
  toggleTask: (id: number) => void;
  deleteTask: (id: number) => void;
  handleAddTask: (e: React.FormEvent) => void;
  addDirectTask: (text: string, dateStr: string) => void;
  removeDirectTask: (text: string, dateStr: string) => void;
}

export function useHomeState(todayStr: string, tomorrowStr: string): HomeState {
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved tasks:', e);
    }
    return [
      { id: 1, text: 'Morning stretch & walk in park', date: todayStr, done: false },
      { id: 2, text: 'Water porch plants & check mail', date: todayStr, done: true },
      { id: 3, text: 'Clubhouse community meetup', date: todayStr, done: false },
      { id: 4, text: 'Pick up items from grocery store', date: tomorrowStr, done: false },
    ];
  });

  const [taskFilter, setTaskFilter] = useState<'today' | 'tomorrow' | 'date' | 'all'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(todayStr);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Failed to persist tasks:', e);
    }
  }, [tasks]);

  const formatFriendlyDate = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        return dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }, []);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'today') {
      return tasks.filter((t) => t.date === todayStr);
    }
    if (taskFilter === 'tomorrow') {
      return tasks.filter((t) => t.date === tomorrowStr);
    }
    if (taskFilter === 'date') {
      return tasks.filter((t) => t.date === selectedDate);
    }
    return tasks;
  }, [tasks, taskFilter, todayStr, tomorrowStr, selectedDate]);

  const doneCount = useMemo(() => {
    return filteredTasks.filter((t) => t.done).length;
  }, [filteredTasks]);

  const toggleTask = useCallback((id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, []);

  const deleteTask = useCallback((id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleAddTask = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskText.trim()) return;

      const newTask: TaskItem = {
        id: Date.now(),
        text: newTaskText.trim(),
        date: newTaskDate || todayStr,
        done: false,
      };

      setTasks((prev) => [newTask, ...prev]);
      setNewTaskText('');
      setIsAddTaskModalOpen(false);
    },
    [newTaskText, newTaskDate, todayStr]
  );

  const addDirectTask = useCallback((text: string, dateStr: string) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.text === text && t.date === dateStr);
      if (exists) return prev;
      return [
        {
          id: Date.now(),
          text,
          date: dateStr,
          done: false,
        },
        ...prev,
      ];
    });
  }, []);

  const removeDirectTask = useCallback((text: string, dateStr: string) => {
    setTasks((prev) => prev.filter((t) => !(t.text === text && t.date === dateStr)));
  }, []);

  return {
    tasks,
    setTasks,
    taskFilter,
    setTaskFilter,
    selectedDate,
    setSelectedDate,
    isAddTaskModalOpen,
    setIsAddTaskModalOpen,
    newTaskText,
    setNewTaskText,
    newTaskDate,
    setNewTaskDate,
    isCalendarModalOpen,
    setIsCalendarModalOpen,
    calendarViewDate,
    setCalendarViewDate,
    formatFriendlyDate,
    doneCount,
    filteredTasks,
    toggleTask,
    deleteTask,
    handleAddTask,
    addDirectTask,
    removeDirectTask,
  };
}
