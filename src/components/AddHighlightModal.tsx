/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Pin,
  Tag,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { PinnedHighlight } from '../types';

interface AddHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHighlight: (newHighlight: Omit<PinnedHighlight, 'id' | 'createdAt'>) => void;
}

const HIGHLIGHT_CATEGORIES = [
  'Facility Update',
  'Resident Amenity',
  'Safety Notice',
  'Community Life',
  'Maintenance Alert',
  'Administration Notice',
];

export const AddHighlightModal: React.FC<AddHighlightModalProps> = ({
  isOpen,
  onClose,
  onAddHighlight,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Facility Update');
  const [authorLabel, setAuthorLabel] = useState('Pinned by Management');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Highlight title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    onAddHighlight({
      title: title.trim(),
      category: category.trim(),
      authorLabel: authorLabel.trim() || 'Pinned by Management',
      description: description.trim(),
    });

    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-highlight-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4"
        >
          <motion.div
            key="add-highlight-modal"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-800 to-amber-700 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                  <Pin className="w-5 h-5 text-amber-200 rotate-12" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight serif-title">
                    Create Pinned Highlight
                  </h2>
                  <p className="text-[11px] text-amber-100 font-medium">
                    Pin a high-priority announcement to the Community Bulletin
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
                  Highlight Headline *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. South Pine Loop & Gazebo Restoration Complete"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-amber-600"
                  required
                />
              </div>

              {/* Category & Author Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Badge Category</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-amber-600"
                  >
                    {HIGHLIGHT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span>Attribution Subtitle</span>
                  </label>
                  <input
                    type="text"
                    value={authorLabel}
                    onChange={(e) => setAuthorLabel(e.target.value)}
                    placeholder="e.g. Pinned by Management or Tech Concierge"
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-amber-600"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Notice Body *
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the update, important instructions, dates, or contact info..."
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-amber-600 resize-none"
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
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pin Highlight</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
