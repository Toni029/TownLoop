/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Pill,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Plus,
  RotateCcw,
  Sun,
  Clock,
  Sunset,
  Moon,
  Trash2,
  PlusCircle,
  Check,
  ChevronDown,
  Pencil,
  FileText,
  Info,
} from 'lucide-react';
import type { MedicationItem, MedicationTimeSlot } from '../types';
import { AddMedicationModal } from './AddMedicationModal';
import { loadResidentMedications, updateResidentMedications, validateMedications } from '../localData/medications';

// Dedicated Orange Pill Bottle SVG Icon for maximum visual clarity
export const OrangePillBottleIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Cap */}
    <rect
      x="7"
      y="2"
      width="10"
      height="3.5"
      rx="1"
      fill="#F3F4F6"
      stroke="#6B7280"
      strokeWidth="1.2"
    />
    <line x1="8.5" y1="3.8" x2="15.5" y2="3.8" stroke="#9CA3AF" strokeWidth="1" />
    {/* Orange Bottle Body */}
    <rect
      x="5.5"
      y="5.5"
      width="13"
      height="15.5"
      rx="2.5"
      fill="#F97316"
      stroke="#C2410C"
      strokeWidth="1.3"
    />
    {/* Rx White Label */}
    <rect
      x="7.5"
      y="9"
      width="9"
      height="8.5"
      rx="1.2"
      fill="#FFFFFF"
      opacity="0.95"
    />
    {/* Red Medical Cross on Label */}
    <path
      d="M12 11V15.5M9.8 13.2H14.2"
      stroke="#DC2626"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Glass Reflection Highlight */}
    <path
      d="M7 7.5V19"
      stroke="#FED7AA"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity="0.75"
    />
  </svg>
);

interface DailyMedicationsProps {
  todayStr: string; // e.g. YYYY-MM-DD
  onShowToast?: (message: string) => void;
  userId?: string | number;
}

const STORAGE_KEY = 'cecil_pines_medications_v1';
const DEFAULT_PHARMACY_PHONE = '(904) 555-0199';

const TIME_SLOT_META: Record<
  MedicationTimeSlot,
  {
    title: string;
    sublabel: string;
    icon: React.ElementType;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  morning: {
    title: 'Morning',
    sublabel: 'With Breakfast',
    icon: Sun,
    badgeBg: 'bg-amber-100/90 dark:bg-amber-950/70',
    badgeText: 'text-amber-900 dark:text-amber-200',
    badgeBorder: 'border-amber-300 dark:border-amber-700',
  },
  noon: {
    title: 'Noon',
    sublabel: 'Lunchtime',
    icon: Clock,
    badgeBg: 'bg-emerald-100/90 dark:bg-emerald-950/70',
    badgeText: 'text-emerald-900 dark:text-emerald-200',
    badgeBorder: 'border-emerald-300 dark:border-emerald-700',
  },
  evening: {
    title: 'Evening',
    sublabel: 'With Dinner',
    icon: Sunset,
    badgeBg: 'bg-indigo-100/90 dark:bg-indigo-950/70',
    badgeText: 'text-indigo-900 dark:text-indigo-200',
    badgeBorder: 'border-indigo-300 dark:border-indigo-700',
  },
  bedtime: {
    title: 'Bedtime',
    sublabel: 'Before Sleep',
    icon: Moon,
    badgeBg: 'bg-purple-100/90 dark:bg-purple-950/70',
    badgeText: 'text-purple-900 dark:text-purple-200',
    badgeBorder: 'border-purple-300 dark:border-purple-700',
  },
};

const TIME_SLOT_ORDER: MedicationTimeSlot[] = ['morning', 'noon', 'evening', 'bedtime'];

export const DailyMedications: React.FC<DailyMedicationsProps> = (props) =>
  props.userId === undefined ? null : <ResidentMedications key={String(props.userId)} {...props} />;

const ResidentMedications: React.FC<DailyMedicationsProps> = ({
  todayStr,
  onShowToast,
  userId,
}) => {
  const uid = String(userId);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<MedicationItem | null>(null);
  const [hasLegacy, setHasLegacy] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
  });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState('');
  const mounted = useRef(true);
  async function load() {
    setReady(false);
    setStorageError('');
    try {
      const saved = await loadResidentMedications(uid);
      if (mounted.current) { setMedications(saved); setReady(true); }
    } catch (error) {
      if (mounted.current) setStorageError(error instanceof Error ? error.message : 'Saved records could not be loaded. They have been preserved.');
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('townloop-medication-deletion');
    if (channel) channel.onmessage = event => {
      if (event.data?.type === 'deleted' && event.data.uid === uid) {
        setMedications([]); setReady(false);
        setStorageError('Local medication records were removed after account deletion.');
      }
    };
    return () => { mounted.current = false; channel?.close(); };
  }, [uid]);
  async function change(update: (current: MedicationItem[]) => MedicationItem[]) {
    if (!ready) return false;
    setSaving(true); setStorageError('');
    try {
      const saved = await updateResidentMedications(uid, update);
      if (!mounted.current) return false;
      setMedications(saved);
      return true;
    } catch (error) {
      if (mounted.current) {
        setStorageError(error instanceof Error ? error.message : 'Your change could not be saved. Existing records are preserved.');
        onShowToast?.('Medication change was not saved. Please retry.');
      }
      return false;
    } finally { if (mounted.current) setSaving(false); }
  }
  async function copyLegacy() {
    try {
      const parsed = validateMedications(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
      if (await change(current => [...current, ...parsed.filter(m => !current.some(c => c.id === m.id))]))
        onShowToast?.('Copied and verified your old records in encrypted browser storage. The original browser copy remains until you remove it.');
    } catch { onShowToast?.('Saved browser records could not be read. They have been preserved.'); }
  }
  function removeLegacy() {
    if (!window.confirm('Permanently remove the old medication records saved in this browser? Only remove them after confirming your records were copied to this account or if you no longer need them.')) return;
    try { localStorage.removeItem(STORAGE_KEY); setHasLegacy(false); }
    catch { onShowToast?.('Old browser records could not be removed.'); }
  }

  const sectionRef = useRef<HTMLElement>(null);
  const savedTopRef = useRef<number | null>(null);

  // Maintain completely static scroll position when expanding or collapsing the tile
  useLayoutEffect(() => {
    if (savedTopRef.current !== null && sectionRef.current) {
      const targetTop = savedTopRef.current;
      savedTopRef.current = null;
      const mainEl = sectionRef.current.closest('main') || document.querySelector('main');

      const fixScroll = () => {
        if (!sectionRef.current) return;
        const currentTop = sectionRef.current.getBoundingClientRect().top;
        const diff = currentTop - targetTop;
        if (Math.abs(diff) > 0.5) {
          if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
            mainEl.scrollTop += diff;
          } else {
            window.scrollBy(0, diff);
          }
        }
      };

      // Run immediately before paint
      fixScroll();

      // Also monitor during the transition animation frames to counteract any browser scroll drift
      const startTime = performance.now();
      let animId: number;
      const step = (time: number) => {
        fixScroll();
        if (time - startTime < 350) {
          animId = requestAnimationFrame(step);
        }
      };
      animId = requestAnimationFrame(step);

      return () => cancelAnimationFrame(animId);
    }
  }, [isExpanded]);

  const handleTakeDose = async (med: MedicationItem) => {
    const formattedTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    if (await change(prev => prev.map(item => item.id === med.id && item.lastTakenDate !== todayStr ? {
      ...item, bottleCount: Math.max(0, item.bottleCount - item.doseCount), lastTakenDate: todayStr, lastTakenTime: formattedTime,
    } : item))) onShowToast?.(`✓ Marked ${med.name} as taken.`);
  };
  const handleUndoDose = async (med: MedicationItem) => {
    if (await change(prev => prev.map(item => item.id === med.id && item.lastTakenDate === todayStr ? {
      ...item, bottleCount: item.bottleCount + item.doseCount, lastTakenDate: undefined, lastTakenTime: undefined,
    } : item))) onShowToast?.(`Undid ${med.name}. Restored dose to bottle.`);
  };
  const handleRestock = async (id: string, amount = 30) => {
    if (await change(prev => prev.map(item => item.id === id ? { ...item, bottleCount: item.bottleCount + amount } : item)))
      onShowToast?.(`Added +${amount} pills to prescription bottle.`);
  };
  const handleDeleteMed = async (id: string, name: string) => {
    if (await change(prev => prev.filter(item => item.id !== id))) onShowToast?.(`Removed ${name} from reminders.`);
  };
  const handleSaveMedication = async (medData: Omit<MedicationItem, 'id' | 'createdAt'>, editingId?: string) => {
    const next: MedicationItem = { ...medData, id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, pharmacyPhone: medData.pharmacyPhone || DEFAULT_PHARMACY_PHONE, createdAt: Date.now() };
    const saved = await change(prev => editingId ? prev.map(item => item.id === editingId ? { ...item, ...medData } : item) : [...prev, next]);
    if (saved) { onShowToast?.(`Saved ${medData.name}.`); setEditingMedication(null); }
    return saved;
  };

  // Stats for today
  const totalMedications = medications.length;
  const takenCount = medications.filter(
    (m) => m.lastTakenDate === todayStr
  ).length;

  return (
    <>
      <section
        ref={sectionRef}
        aria-label="Daily Medications"
        className="daily-medications-tile relative bg-gradient-to-br from-[#f8fbfd] via-[#f1f6fa] to-[#e8f2f9] dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-800/90 border border-[#cfe0ee] dark:border-slate-800 rounded-[30px] p-4 sm:p-5 shadow-sm transition-all duration-300"
      >
        {/* Expand / Collapse Button strictly pinned at the Top Right Corner */}
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            if (sectionRef.current) {
              savedTopRef.current = sectionRef.current.getBoundingClientRect().top;
            }
            setIsExpanded((prev) => !prev);
          }}
          className={`absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-colors duration-300 z-10 shadow-xs border cursor-pointer ${
            isExpanded
              ? 'bg-sky-700 text-white border-sky-600 shadow-sky-700/25'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-700 hover:border-sky-300'
          }`}
          title={isExpanded ? 'Collapse Daily Medications' : 'Expand Daily Medications'}
          aria-label={isExpanded ? 'Collapse Daily Medications' : 'Expand Daily Medications'}
        >
          <ChevronDown
            className={`w-5 h-5 stroke-[2.5] transition-transform duration-300 ease-in-out ${
              isExpanded ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>

        {/* Header with Title, Progress, and Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-12 sm:pr-14">
          <div className="flex items-center gap-3 min-w-0">
            {/* Orange Pill Bottle Graphic Badge */}
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 dark:bg-amber-500/30 border border-amber-500/40 flex items-center justify-center shadow-xs shrink-0">
              <OrangePillBottleIcon className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Daily Medications
              </h2>
              <p className="text-xs font-semibold text-sky-800 dark:text-sky-300 truncate">
                {takenCount === totalMedications && totalMedications > 0
                  ? 'All doses completed for today! 🎉'
                  : `${takenCount} of ${totalMedications} doses taken today`}
              </p>
            </div>
          </div>

          {/* Header Action Buttons in Web / Mobile View */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-sky-800 dark:text-sky-200 bg-sky-100/90 dark:bg-sky-950 px-3 py-1.5 rounded-full border border-sky-200 dark:border-sky-800 shadow-xs whitespace-nowrap">
              {takenCount}/{totalMedications} Done
            </span>

            <button
              type="button"
              disabled={!ready || saving}
              onClick={() => {
                setEditingMedication(null);
                setIsAddModalOpen(true);
              }}
              className="min-h-[40px] px-4 py-2 bg-sky-700 hover:bg-sky-800 active:scale-98 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Add Medication Reminder"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Medication</span>
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          Personal tracking only; not medical advice. Follow your clinician’s directions. Reminders are not guaranteed; use another reliable reminder.
          {' '}Records are encrypted in this browser for your account and remain after refresh. Clearing browser data removes them. Use a trusted device; browser scripts can still access your records.
        </p>
        {!ready && !storageError && <p role="status" className="mt-2 text-xs">Loading saved medication records…</p>}
        {saving && <p role="status" className="mt-2 text-xs">Saving medication records…</p>}
        {storageError && <div role="alert" className="mt-2 text-xs"><p>{storageError}</p><button type="button" onClick={() => void load()} className="min-h-[44px] underline">Retry loading saved records</button></div>}
        {hasLegacy && <div className="mt-3 text-xs space-y-2" role="status">
          <p>Old medication records remain saved in this browser without app-level encryption. Their owner cannot be verified. Copy them only if they belong to you. The original is kept until you explicitly remove it.</p>
          <div className="flex gap-3 flex-wrap">
            <button type="button" onClick={copyLegacy} disabled={!ready || saving} className="min-h-[44px] underline">Copy my old records to this account</button>
            <button type="button" onClick={removeLegacy} className="min-h-[44px] underline">Remove old browser records</button>
          </div>
        </div>}

        {/* ======================================================== */}
        {/* EXPANDABLE CONTENT: Smooth CSS Grid Accordion Transition */}
        {/* ======================================================== */}
        <div
          className={`grid transition-[grid-template-rows,margin] duration-300 ease-in-out ${
            isExpanded ? 'grid-rows-[1fr] mt-4' : 'grid-rows-[0fr] mt-0'
          }`}
        >
          <div className="overflow-hidden">
            <fieldset disabled={!ready || saving} className="contents">
            <div
              className={`space-y-4 pt-1 transition-opacity duration-300 ease-in-out ${
                isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
            {!ready ? <p className="text-sm">Saved medication records are not available yet. Check the storage message above.</p> : totalMedications === 0 ? (
              <div className="text-center py-8 px-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center mx-auto mb-2.5">
                  <OrangePillBottleIcon className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No medications scheduled yet.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Click "+ Add Medication" above to set up your daily pill reminder and doctor directions.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {[...medications]
                  .sort((a, b) => {
                    const orderA = TIME_SLOT_ORDER.indexOf(a.timeSlot);
                    const orderB = TIME_SLOT_ORDER.indexOf(b.timeSlot);
                    return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
                  })
                  .map((med) => {
                    const isTakenToday = med.lastTakenDate === todayStr;
                    const isLowSupply = med.bottleCount <= 5;
                    const slotMeta = TIME_SLOT_META[med.timeSlot];
                    const SlotIcon = slotMeta.icon;

                    return (
                      <div
                        key={med.id}
                        className={`relative transition-all duration-200 bg-white dark:bg-slate-900 border-2 shadow-sm rounded-2xl p-4 sm:p-5 ${
                          isTakenToday
                            ? 'border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : 'border-slate-200/90 dark:border-slate-700/90 hover:border-sky-400 dark:hover:border-sky-600'
                        }`}
                      >
                        {/* Card Header & Content */}
                        <div className="space-y-3.5">
                          {/* Top Row: Name, Time Slot Badge, & Quick Edit/Delete */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              {/* Orange Pill Bottle Icon Box */}
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                                <OrangePillBottleIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                    {med.name}
                                  </h3>

                                  {/* Taken Badge */}
                                  {isTakenToday && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                      <span>Taken {med.lastTakenTime || 'Today'}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Top Right Quick Edit & Delete Controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMedication(med);
                                  setIsAddModalOpen(true);
                                }}
                                className="w-8 h-8 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors flex items-center justify-center cursor-pointer"
                                title={`Edit ${med.name}`}
                                aria-label={`Edit ${med.name}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMed(med.id, med.name)}
                                className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-center cursor-pointer"
                                title={`Delete ${med.name}`}
                                aria-label={`Delete ${med.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Dose & Bottle Count Pill Indicators - Enlarged boxes so all text and letters fit cleanly */}
                          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span className="min-h-[42px] sm:min-h-[44px] py-2 px-2.5 sm:px-3.5 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-extrabold text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 shadow-2xs whitespace-nowrap">
                              <Pill className="w-4 h-4 text-sky-600 shrink-0" />
                              <span>
                                Take {med.doseCount}{' '}
                                {med.doseCount === 1 ? 'pill' : 'pills'}
                              </span>
                            </span>

                            <span
                              className={`min-h-[42px] sm:min-h-[44px] py-2 px-2.5 sm:px-3.5 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl font-extrabold text-xs sm:text-[13px] border shadow-2xs whitespace-nowrap ${
                                isLowSupply
                                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 animate-pulse'
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-200/90 dark:border-amber-800'
                              }`}
                            >
                              <OrangePillBottleIcon className="w-4 h-4 shrink-0" />
                              <span>{med.bottleCount} left in bottle</span>
                            </span>
                          </div>

                          {/* ========================================================= */}
                          {/* MEANINGFUL, PROMINENT & BIGGER INSTRUCTIONS / DOCTOR BOX */}
                          {/* ========================================================= */}
                          <div className="bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 transition-colors">
                            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                                  <span>Doctor's Directions & Instructions</span>
                                </span>

                                {/* Schedule Time Slot Tag placed inside the instruction box */}
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${slotMeta.badgeBg} ${slotMeta.badgeText} ${slotMeta.badgeBorder}`}>
                                  <SlotIcon className="w-3.5 h-3.5 shrink-0" />
                                  <span>{slotMeta.title} ({slotMeta.sublabel})</span>
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMedication(med);
                                  setIsAddModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer flex items-center gap-1 ml-auto"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>{med.instructions ? 'Edit Notes' : '+ Add Notes'}</span>
                              </button>
                            </div>

                            {med.instructions ? (
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed pl-5.5 border-l-2 border-sky-500 dark:border-sky-400">
                                {med.instructions}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 dark:text-slate-500 italic pl-5.5">
                                No special instructions entered. Click "Edit Notes" to add meal, water, or timing directions.
                              </p>
                            )}
                          </div>

                          {/* Action Button Row for Web View & Mobile */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {isTakenToday ? (
                                <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  Dose recorded for today at {med.lastTakenTime || 'Recorded'}
                                </span>
                              ) : (
                                <span>Scheduled for {slotMeta.title} ({slotMeta.sublabel})</span>
                              )}
                            </div>

                            {/* Clean Responsive Buttons - Strictly in the Same Row on Mobile and Desktop */}
                            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                              {isTakenToday ? (
                                <button
                                  type="button"
                                  onClick={() => handleUndoDose(med)}
                                  className="min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                                  title="Accidental tap? Undo dose"
                                >
                                  <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                                  <span>Undo Dose</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTakeDose(med)}
                                  className="min-h-[42px] px-4 sm:px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                                >
                                  <Check className="w-5 h-5 stroke-[3] shrink-0" />
                                  <span>Take Now</span>
                                </button>
                              )}

                              {/* Quick Restock Refill button */}
                              <button
                                type="button"
                                onClick={() => handleRestock(med.id, 30)}
                                className="min-h-[42px] px-3 sm:px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                                title="Picked up pharmacy refill? Add +30 pills"
                              >
                                <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>+30 Refill</span>
                              </button>
                            </div>
                          </div>

                          {/* Low Supply Warning Banner with Pharmacy Call Button */}
                          {isLowSupply && (
                            <div className="mt-2 pt-2.5 border-t border-rose-200 dark:border-rose-900/60 flex items-center justify-between flex-wrap gap-2.5 bg-rose-50/90 dark:bg-rose-950/40 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3.5 sm:px-5 rounded-b-2xl border-x-0 border-b-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                                <p className="text-xs font-bold text-rose-800 dark:text-rose-200 truncate">
                                  Low Supply: <span className="underline font-black">{med.bottleCount} pills remaining</span>
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:justify-end">
                                <a
                                  href={`tel:${med.pharmacyPhone || DEFAULT_PHARMACY_PHONE}`}
                                  className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                                  title={`Call Pharmacy at ${med.pharmacyPhone || DEFAULT_PHARMACY_PHONE}`}
                                >
                                  <Phone className="w-3.5 h-3.5 shrink-0" />
                                  <span>Call Pharmacy</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleRestock(med.id, 30)}
                                  className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-xs cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                                  title="Picked up refill? Add 30 pills"
                                >
                                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>+30 Refill</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </fieldset>
          </div>
        </div>
      </section>

      {/* Add / Edit Medication Modal */}
      <AddMedicationModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingMedication(null);
        }}
        onSave={handleSaveMedication}
        initialData={editingMedication}
      />
    </>
  );
};
