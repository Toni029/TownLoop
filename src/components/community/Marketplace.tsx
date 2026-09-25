/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState } from 'react';
import {
  CheckCircle2,
  MessageSquare,
  Tag,
  Clock,
  Maximize2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { CommunityState } from '../../hooks/useCommunityState';
import { canDeleteAnyPost } from '../../utils/permissions';

type MarketplaceProps = Pick<
  CommunityState,
  | 'currentUser'
  | 'marketItems'
  | 'isItemCreator'
  | 'handleDeleteItem'
  | 'setFullscreenMedia'
  | 'setSelectedDetailMarket'
  | 'handleToggleSoldItem'
  | 'handleOpenMessageSeller'
>;

export function Marketplace({
  currentUser,
  marketItems,
  isItemCreator,
  handleDeleteItem,
  setFullscreenMedia,
  setSelectedDetailMarket,
  handleToggleSoldItem,
  handleOpenMessageSeller,
}: MarketplaceProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);

  return (
    <div className="space-y-3.5">
      {marketItems.length === 0 ? (
        <div className="rounded-3xl p-8 bg-white/90 dark:bg-slate-900/90 border border-stone-200/90 dark:border-slate-800 text-center space-y-3 shadow-2xs backdrop-blur-xs my-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200/60 dark:border-emerald-800/40">
            <Tag className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              No Marketplace Listings Yet
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              The marketplace feed is currently empty. Tap the post button above to list furniture, tools, books, or giveaways for your neighbors!
            </p>
          </div>
        </div>
      ) : (
        marketItems.map((item) => {
          const isSold = Boolean(item.sold || item.claimed);
        const isOwner = isItemCreator(item);
        const canDelete = canDeleteAnyPost(currentUser) || isOwner;
        const itemMedia = (item.media && item.media.length > 0)
          ? item.media
          : item.mediaUrl
            ? [{ type: 'image' as const, url: item.mediaUrl, name: item.title }]
            : item.photoUrl
              ? [{ type: 'image' as const, url: item.photoUrl, name: item.title }]
              : [];

        return (
          <div
            key={item.id}
            className={`rounded-2xl p-4 transition space-y-3 relative ${
              isSold
                ? 'bg-stone-100/90 dark:bg-slate-900/90 border border-stone-300/80 dark:border-slate-800 opacity-60 grayscale-[35%]'
                : 'bg-white dark:bg-slate-900/80 border border-stone-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs hover:border-stone-300 dark:hover:border-slate-700'
            }`}
          >
            {/* Top Header Row: Author Name, Unit, Time Ago & Badges */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Author Avatar */}
                <div className="w-8 h-8 rounded-full overflow-hidden bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 shrink-0 flex items-center justify-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {item.authorAvatar ? (
                    <img
                      src={item.authorAvatar}
                      alt={item.author}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    item.author.slice(0, 2).toUpperCase()
                  )}
                </div>
                {/* Author Name and Timestamp */}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-stone-900 dark:text-slate-100 truncate">
                    {item.author}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-slate-500">
                    <Clock className="w-3 h-3 text-stone-400 dark:text-slate-500 shrink-0" />
                    <span>{item.timeAgo || 'Recently posted'}</span>
                  </div>
                </div>
              </div>

              {/* Badges: Status (Available / Sold) + Price + Delete */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs ${
                    isSold
                      ? 'text-stone-600 dark:text-slate-300 bg-stone-200/90 dark:bg-slate-800 border border-stone-300 dark:border-slate-700'
                      : 'text-emerald-800 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSold ? 'bg-stone-500' : 'bg-emerald-600'
                    }`}
                  />
                  <span>{isSold ? 'Sold' : 'Available'}</span>
                </span>

                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs ${
                    isSold
                      ? 'bg-stone-400 text-white'
                      : item.price.toUpperCase() === 'FREE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-600 text-white'
                  }`}
                >
                  {item.price}
                </span>

                {/* Trash can icon to delete listing for Admin, VIP, or Item Owner */}
                {canDelete && (
                  confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg px-2 py-0.5">
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">Delete?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id, true);
                          setConfirmDeleteId(null);
                        }}
                        className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="text-[10px] text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 px-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(item.id);
                      }}
                      title="Delete listing (Admin/VIP/Author)"
                      className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Main Item Body: Thumbnail & Info */}
            <div className="flex gap-3.5 items-start">
              {/* Media thumbnail */}
              <div
                onClick={(e) => {
                  if (itemMedia.length > 0) {
                    e.stopPropagation();
                    setFullscreenMedia({
                      media: itemMedia,
                      initialIndex: 0,
                      title: item.title,
                      author: item.author,
                    });
                  } else {
                    setSelectedDetailMarket(item);
                  }
                }}
                className="cursor-pointer w-20 h-20 rounded-xl overflow-hidden bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 shrink-0 flex items-center justify-center relative hover:opacity-95 transition group/thumb hover:ring-2 hover:ring-emerald-600/30"
                title={
                  itemMedia.length > 0
                    ? 'Click to view full screen & pinch-to-zoom'
                    : 'View item'
                }
              >
                {itemMedia.length > 0 ? (
                  itemMedia[0].type === 'image' ? (
                    <>
                      <img
                        src={itemMedia[0].url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/25 transition flex items-center justify-center">
                        <div className="opacity-0 group-hover/thumb:opacity-100 transition p-1 rounded-full bg-black/70 text-white shadow-xs">
                          <Maximize2 className="w-3 h-3" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-stone-900 flex items-center justify-center text-white relative">
                      <span className="text-xs font-medium">▶ Video</span>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                    <Tag className="w-7 h-7 stroke-current" />
                  </div>
                )}
                {itemMedia.length > 1 && (
                  <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-bold px-1 rounded">
                    +{itemMedia.length - 1}
                  </span>
                )}
                {isSold && (
                  <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-[0.5px] flex items-center justify-center">
                    <span className="text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-stone-900/90 rounded border border-white/30 shadow-xs">
                      Sold
                    </span>
                  </div>
                )}
              </div>

              {/* Title and Description */}
              <div className="flex-1 min-w-0">
                <h4
                  onClick={() => setSelectedDetailMarket(item)}
                  className={`font-bold text-sm cursor-pointer transition leading-snug ${
                    isSold
                      ? 'text-stone-600 dark:text-slate-500 line-through decoration-stone-400 dark:decoration-slate-600'
                      : 'text-stone-900 dark:text-slate-100 hover:text-emerald-800 dark:hover:text-emerald-400'
                  }`}
                >
                  {item.title}
                </h4>
                <p
                  onClick={() => setSelectedDetailMarket(item)}
                  className="text-xs text-stone-600 dark:text-slate-300 mt-1 line-clamp-2 cursor-pointer leading-relaxed"
                >
                  {item.description}
                </p>
              </div>
            </div>

            {/* Footer: Pickup location & Actions (Mark as Sold for owner, Message Seller for neighbors) */}
            <div className="pt-2.5 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
              <span className="text-stone-500 dark:text-slate-400 text-[11px] sm:text-xs font-medium truncate">
                Porch pickup
              </span>

              <div className="shrink-0 flex items-center gap-2 my-0.5">
                {isOwner ? (
                  <button
                    id={`toggle-sold-${item.id}`}
                    onClick={() => handleToggleSoldItem(item.id)}
                    className={`liquid-glass-pill ${
                      isSold ? 'sold-state' : ''
                    }`}
                  >
                    {isSold ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 text-stone-600 dark:text-slate-400 shrink-0" />
                        <span>Mark as Available</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Mark as Sold</span>
                      </>
                    )}
                  </button>
                ) : isSold ? (
                  <span className="text-stone-500 dark:text-slate-400 text-xs font-semibold italic px-2.5 py-1 bg-stone-100 dark:bg-slate-800 rounded-lg">
                    Item Sold
                  </span>
                ) : (
                  <button
                    id={`message-seller-${item.id}`}
                    onClick={() => handleOpenMessageSeller(item)}
                    className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3.5 py-1.5 rounded-xl transition shadow-2xs cursor-pointer active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message Seller</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }))}
    </div>
  );
}
