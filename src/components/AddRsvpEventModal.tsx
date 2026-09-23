/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CalendarPlus,
  Clock,
  MapPin,
  Tag,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Edit3,
} from 'lucide-react';
import type { CommunityRsvpEvent } from '../types';

interface AddRsvpEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (newEvent: Omit<CommunityRsvpEvent, 'id' | 'userRsvp' | 'attendeesCount'>) => void;
  editingEvent?: CommunityRsvpEvent | null;
  onUpdateEvent?: (updatedEvent: CommunityRsvpEvent) => void;
}

const EVENT_CATEGORIES = [
  'Health & Wellness',
  'Social Event',
  'Dining & Food',
  'Educational',
  'Arts & Crafts',
  'Sports & Fitness',
  'Community Meeting',
  'Special Holiday',
];

export const AddRsvpEventModal: React.FC<AddRsvpEventModalProps> = ({
  isOpen,
  onClose,
  onAddEvent,
  editingEvent,
  onUpdateEvent,
}) => {
  const [title, setTitle] = useState('');
  const [month, setMonth] = useState('OCT');
  const [day, setDay] = useState('15');
  const [time, setTime] = useState('2:00 PM – 3:30 PM');
  const [location, setLocation] = useState('Community Center');
  const [category, setCategory] = useState('Social Event');
  const [spotsLeft, setSpotsLeft] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever modal opens or editingEvent changes
  useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        setTitle(editingEvent.title || '');
        setMonth(
          editingEvent.month ? editingEvent.month.toUpperCase().slice(0, 3) : 'OCT'
        );
        setDay(String(editingEvent.day || '15'));
        setTime(editingEvent.time || '2:00 PM');
        setLocation(editingEvent.location || 'Community Center');
        setCategory(editingEvent.category || 'Social Event');
        const cap =
          editingEvent.spotsLeft !== undefined
            ? editingEvent.spotsLeft
            : editingEvent.capacity !== undefined && editingEvent.capacity !== null
            ? editingEvent.capacity
            : '';
        setSpotsLeft(cap);
        setDescription(editingEvent.description || '');
      } else {
        setTitle('');
        setMonth('OCT');
        setDay('15');
        setTime('2:00 PM – 3:30 PM');
        setLocation('Community Center');
        setCategory('Social Event');
        setSpotsLeft('');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, editingEvent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Event title is required.');
      return;
    }
    if (!day.trim() || !month.trim()) {
      setError('Event date is required.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a brief event description.');
      return;
    }

    const parsedSpots =
      typeof spotsLeft === 'number' && spotsLeft > 0 ? spotsLeft : undefined;

    if (editingEvent && onUpdateEvent) {
      onUpdateEvent({
        ...editingEvent,
        title: title.trim(),
        month: month.trim().toUpperCase(),
        day: day.trim(),
        time: time.trim() || 'TBA',
        location: location.trim() || 'Cecil Pines Community Center',
        category: category.trim(),
        spotsLeft: parsedSpots,
        capacity: parsedSpots ?? null,
        description: description.trim(),
      });
    } else {
      onAddEvent({
        title: title.trim(),
        month: month.trim().toUpperCase(),
        day: day.trim(),
        time: time.trim() || 'TBA',
        location: location.trim() || 'Cecil Pines Community Center',
        category: category.trim(),
        spotsLeft: parsedSpots,
        capacity: parsedSpots ?? null,
        description: description.trim(),
      });
    }

    // Reset & Close
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  const isEditing = Boolean(editingEvent);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-rsvp-event-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4"
        >
          <motion.div
            key="add-rsvp-event-modal"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                  {isEditing ? (
                    <Edit3 className="w-5 h-5 text-emerald-300" />
                  ) : (
                    <CalendarPlus className="w-5 h-5 text-emerald-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight serif-title">
                      {isEditing ? 'Edit RSVP Event' : 'Create RSVP Event'}
                    </h2>
                  </div>
                  <p className="text-[11px] text-emerald-200 font-medium">
                    {isEditing
                      ? 'Review and adjust event details, schedule, or attendee capacity'
                      : 'Publish event to Community Bulletin for resident sign-up'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="p-5 overflow-y-auto space-y-3.5 text-stone-900 dark:text-stone-100"
            >
              {error && (
                <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Autumn Harvest Festival & Pie Bake-Off"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600"
                  required
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Month *
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600"
                  >
                    {[
                      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
                    ].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Day *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    placeholder="15"
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Time
                  </label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="e.g. 2:00 PM"
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* Location & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Location</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Community Center or Magnolia Hall"
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Category</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600"
                  >
                    {EVENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Spots Capacity */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Available Spots / Capacity (Optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={spotsLeft}
                  onChange={(e) =>
                    setSpotsLeft(e.target.value ? Number(e.target.value) : '')
                  }
                  placeholder="e.g. 30"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Description & RSVP Details *
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about what to expect, what to bring, host details, and RSVP instructions..."
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-emerald-600 resize-none"
                  required
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? 'Save Changes' : 'Create Event'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
