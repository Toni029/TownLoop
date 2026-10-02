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
  Pill,
  Sun,
  Clock,
  Sunset,
  Moon,
  Plus,
  Minus,
  FileText,
  Sparkles,
  Phone,
  Check,
} from 'lucide-react';
import type { MedicationItem, MedicationTimeSlot } from '../types';

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (medication: Omit<MedicationItem, 'id' | 'createdAt'>, editingId?: string) => void;
  initialData?: MedicationItem | null;
}

const TIME_SLOT_OPTIONS: {
  id: MedicationTimeSlot;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}[] = [
  { id: 'morning', label: 'Morning', sublabel: 'With Breakfast', icon: Sun },
  { id: 'noon', label: 'Noon', sublabel: 'Lunchtime', icon: Clock },
  { id: 'evening', label: 'Evening', sublabel: 'With Dinner', icon: Sunset },
  { id: 'bedtime', label: 'Bedtime', sublabel: 'Before Sleep', icon: Moon },
];

const COMMON_INSTRUCTION_SUGGESTIONS = [
  'Take with food / meal',
  'Take with a full glass of water',
  'Take on an empty stomach (1 hr before food)',
  'Take 30 minutes before bedtime',
  'Do not crush or chew',
  'Avoid grapefruit / citrus juice',
  'Keep refrigerated',
  'Check blood pressure before taking',
];

export const AddMedicationModal: React.FC<AddMedicationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const isEditing = !!initialData;
  const [name, setName] = useState('');
  const [doseCount, setDoseCount] = useState(1);
  const [timeSlot, setTimeSlot] = useState<MedicationTimeSlot>('morning');
  const [bottleCount, setBottleCount] = useState(30);
  const [instructions, setInstructions] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('(904) 555-0199');
  const [error, setError] = useState<string | null>(null);

  // Populate data when editing or opening
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDoseCount(initialData.doseCount || 1);
      setTimeSlot(initialData.timeSlot || 'morning');
      setBottleCount(initialData.bottleCount ?? 30);
      setInstructions(initialData.instructions || '');
      setPharmacyPhone(initialData.pharmacyPhone || '(904) 555-0199');
    } else {
      setName('');
      setDoseCount(1);
      setTimeSlot('morning');
      setBottleCount(30);
      setInstructions('');
      setPharmacyPhone('(904) 555-0199');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSuggestionClick = (suggestion: string) => {
    setInstructions((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return suggestion;
      if (trimmed.includes(suggestion)) return trimmed;
      return `${trimmed}. ${suggestion}`;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter a medication or supplement name.');
      return;
    }

    onSave(
      {
        name: cleanName,
        doseCount: Math.max(1, doseCount),
        timeSlot,
        bottleCount: Math.max(0, bottleCount),
        instructions: instructions.trim() || undefined,
        pharmacyPhone: pharmacyPhone.trim() || undefined,
        lastTakenDate: initialData?.lastTakenDate,
        lastTakenTime: initialData?.lastTakenTime,
      },
      initialData?.id
    );

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-medication-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/65 backdrop-blur-xl"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="add-medication-window"
            initial={{ opacity: 0, scale: 0.84, y: -24, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              scale: 0.88,
              y: -16,
              filter: 'blur(8px)',
              transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
            }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 280,
              mass: 0.75,
            }}
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] gpu-layer antialiased [text-rendering:optimizeLegibility] relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-med-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dynamic Specular Light Flare Sweep on open */}
            <motion.div
              initial={{ x: '-100%', opacity: 0.6 }}
              animate={{ x: '180%', opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="absolute inset-0 -skew-x-12 pointer-events-none z-10 bg-gradient-to-r from-transparent via-sky-500/10 dark:via-white/10 to-transparent w-full h-full"
            />
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-50 via-emerald-50/40 to-white dark:from-slate-800/90 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h3
                id="add-med-title"
                className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100"
              >
                {isEditing ? 'Edit Medication' : 'Add Medication Reminder'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing
                  ? 'Update dosage, directions, and bottle inventory'
                  : 'Set up your daily dosage and doctor instructions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-2xl">
              {error}
            </div>
          )}

          {/* 1. Medication Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Medication / Supplement Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g., Lisinopril (10 mg), Metformin, Calcium + D3"
              className="w-full text-base font-semibold px-4 py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition min-h-[48px]"
            />
          </div>

          {/* 2. Dose Quantity Counter & Time Slot Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dose Quantity Counter */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Dose Amount
              </label>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 min-h-[58px]">
                <button
                  type="button"
                  onClick={() => setDoseCount((prev) => Math.max(1, prev - 1))}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold text-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition shadow-xs cursor-pointer shrink-0"
                  aria-label="Decrease dose count"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {doseCount}
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {doseCount === 1 ? 'pill per dose' : 'pills per dose'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDoseCount((prev) => Math.min(10, prev + 1))}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold text-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition shadow-xs cursor-pointer shrink-0"
                  aria-label="Increase dose count"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Starting Bottle Quantity */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Pills in Bottle
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={bottleCount}
                  onChange={(e) => setBottleCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-24 text-center text-lg font-bold px-3 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[58px]"
                />
                <div className="grid grid-cols-3 gap-1.5 flex-1">
                  {[30, 60, 90].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBottleCount(preset)}
                      className={`h-[58px] text-xs font-bold rounded-2xl border transition cursor-pointer flex flex-col items-center justify-center ${
                        bottleCount === preset
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-black'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{preset}</span>
                      <span className="text-[10px] opacity-75">pills</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Time Slot Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Daily Schedule Slot
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_SLOT_OPTIONS.map((slot) => {
                const Icon = slot.icon;
                const isSelected = timeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setTimeSlot(slot.id)}
                    className={`min-h-[56px] p-2.5 rounded-2xl border text-left transition flex flex-col justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-sky-700 text-white border-sky-700 shadow-md ring-2 ring-sky-500/30'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-sky-600 dark:text-sky-400'}`} />
                      <span className="font-bold text-xs leading-tight">{slot.label}</span>
                    </div>
                    <span
                      className={`text-[10px] leading-tight truncate ${
                        isSelected ? 'text-sky-100 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {slot.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. EXPANDED, MEANINGFUL INSTRUCTIONS / DESCRIPTION BOX */}
          <div className="space-y-2 bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Special Instructions & Doctor Notes</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-400">
                Optional Directions
              </span>
            </div>

            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Take with breakfast & full glass of water. Do not lie down for 30 minutes after taking. Avoid grapefruit."
              className="w-full text-sm leading-relaxed px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition resize-none shadow-xs"
            />

            {/* Quick-select Instruction Suggestion Chips */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Quick-Add Common Directions:</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_INSTRUCTION_SUGGESTIONS.map((sug) => {
                  const isIncluded = instructions.includes(sug);
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleSuggestionClick(sug)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
                        isIncluded
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700'
                      }`}
                    >
                      {isIncluded && <Check className="w-3 h-3 text-emerald-600" />}
                      <span>{sug}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Pharmacy Phone Number */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Pharmacy Refill Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={pharmacyPhone}
                onChange={(e) => setPharmacyPhone(e.target.value)}
                placeholder="(904) 555-0199"
                className="w-full text-sm font-medium pl-10 pr-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[48px]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[50px] py-3 px-4 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[50px] py-3 px-4 rounded-2xl bg-sky-700 hover:bg-sky-800 active:scale-98 text-white font-bold shadow-md hover:shadow-lg transition cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              <Pill className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Save Medication'}</span>
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
