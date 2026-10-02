/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  ShoppingBag,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Tag,
  Mail,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  MarketplaceChat,
  sendMarketplaceReply,
  markMarketplaceChatRead,
  deleteMarketplaceChat,
} from '../../services/marketplaceChat';

interface MarketplaceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: MarketplaceChat[];
  currentUser?: UserProfile | null;
  activeChatId?: string | null;
  onSelectChat?: (chatId: string | null) => void;
  onDeleteChat?: (chatId: string) => void;
  onViewItem?: (itemId: string) => void;
}

export const MarketplaceChatModal: React.FC<MarketplaceChatModalProps> = ({
  isOpen,
  onClose,
  chats,
  currentUser,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onViewItem,
}) => {
  const [selectedChat, setSelectedChat] = useState<MarketplaceChat | null>(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep selected chat state in sync with activeChatId or chat array updates
  useEffect(() => {
    if (activeChatId) {
      const found = chats.find((c) => c.id === activeChatId);
      if (found) setSelectedChat(found);
    } else if (selectedChat) {
      const updated = chats.find((c) => c.id === selectedChat.id);
      if (updated) setSelectedChat(updated);
    }
  }, [activeChatId, chats]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (selectedChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedChat?.messages]);

  // Mark chat as read when opened
  useEffect(() => {
    if (selectedChat && currentUser) {
      const isSeller =
        String(currentUser.id).toLowerCase() === String(selectedChat.sellerId).toLowerCase() ||
        currentUser.name.toLowerCase() === selectedChat.sellerName.toLowerCase();
      markMarketplaceChatRead(selectedChat.id, isSeller);
    }
  }, [selectedChat, currentUser]);

  const handleClose = () => {
    onClose();
  };

  const handleSelectChat = (chat: MarketplaceChat) => {
    setSelectedChat(chat);
    onSelectChat?.(chat.id);
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    onSelectChat?.(null);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChat) return;

    const textToSend = replyText.trim();
    setReplyText('');

    const effectiveSender = currentUser || {
      id: 'resident',
      name: 'Resident',
      email: '',
      role: 'resident',
    };

    try {
      const updated = await sendMarketplaceReply({
        chat: selectedChat,
        sender: effectiveSender,
        text: textToSend,
      });
      setSelectedChat(updated);
    } catch (err) {
      console.warn('Unable to send reply:', err);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (window.confirm('Delete this marketplace conversation?')) {
      try {
        await deleteMarketplaceChat(chatId);
        onDeleteChat?.(chatId);
        setSelectedChat(null);
        onSelectChat?.(null);
      } catch (err) {
        console.warn('Unable to delete marketplace chat:', err);
      }
    }
  };

  const filteredChats = chats.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.itemTitle.toLowerCase().includes(q) ||
      c.sellerName.toLowerCase().includes(q) ||
      c.buyerName.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="marketplace-inbox-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 bg-stone-950/45 backdrop-blur-xl z-[100] flex items-center justify-center p-3 sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          {/* Floating Liquid Glass Tile Window - Exactly like Profile Menu */}
          <motion.div
            key="marketplace-inbox-floating-window"
            initial={{ opacity: 0, scale: 0.84, y: -28, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              scale: 0.88,
              y: -18,
              filter: 'blur(8px)',
              transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
            }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 280,
              mass: 0.75,
            }}
            className="liquid-glass-modal w-full max-w-[500px] sm:max-w-[540px] h-[520px] sm:h-[580px] rounded-[32px] sm:rounded-[36px] p-4 sm:p-5 pt-3.5 sm:pt-4 shadow-2xl relative flex flex-col overflow-hidden antialiased [text-rendering:optimizeLegibility] bg-white/90 dark:bg-slate-900/90 text-stone-900 dark:text-slate-100 border border-stone-200/80 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Liquid Glass Dynamic Specular Light Flare Sweep */}
            <motion.div
              initial={{ x: '-100%', opacity: 0.8 }}
              animate={{ x: '180%', opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="absolute inset-0 -skew-x-12 pointer-events-none z-10 bg-gradient-to-r from-transparent via-white/25 dark:via-white/12 to-transparent w-full h-full"
            />

            {/* Header Area */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-slate-800/80 shrink-0 pr-12">
              {selectedChat ? (
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="p-1.5 -ml-1.5 rounded-xl text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer flex items-center gap-1 font-bold text-xs sm:text-sm"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Inbox</span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-2xs">
                    <ShoppingBag className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-slate-100 serif-title leading-tight">
                      Marketplace Inbox
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400">
                      Buyer & seller conversations
                    </p>
                  </div>
                </div>
              )}

              {selectedChat && (
                <button
                  type="button"
                  onClick={() => handleDeleteChat(selectedChat.id)}
                  className="w-8.5 h-8.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/80 flex items-center justify-center transition cursor-pointer"
                  title="Delete Conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Close Button matching Profile Menu Floating Subpanel */}
            <button
              type="button"
              onClick={handleClose}
              className="liquid-glass-subpanel liquid-glass-subpanel-interactive !absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition cursor-pointer z-50 text-stone-700 hover:text-stone-900 dark:text-slate-200 dark:hover:text-white"
              aria-label="Close Marketplace Inbox"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content Body: Chat List OR Thread View */}
            {!selectedChat ? (
              /* ============= LIST VIEW ============= */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-3">
                {/* Search Bar */}
                <div className="pb-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search listings or neighbors..."
                      className="w-full pl-9 pr-3 py-2 rounded-2xl text-xs sm:text-sm bg-stone-100/90 dark:bg-slate-800/90 text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 border border-stone-200/80 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                </div>

                {/* Chats Scrollable List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 hide-scrollbar">
                  {filteredChats.length === 0 ? (
                    <div className="text-center py-14 px-4 space-y-3">
                      <div className="w-14 h-14 rounded-full bg-stone-100 dark:bg-slate-800/80 text-stone-400 dark:text-slate-500 mx-auto flex items-center justify-center shadow-2xs">
                        <Mail className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-800 dark:text-slate-200">
                          {searchQuery ? 'No matching chats found' : 'No Marketplace Chats Yet'}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                          {searchQuery
                            ? 'Try a different keyword search'
                            : 'When you tap "Message Seller" on a listing, your buyer & seller conversations sit right here!'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    filteredChats.map((chat) => {
                      const isSeller =
                        currentUser &&
                        (String(currentUser.id).toLowerCase() === String(chat.sellerId).toLowerCase() ||
                          currentUser.name.toLowerCase() === chat.sellerName.toLowerCase());

                      const otherPartyName = isSeller ? chat.buyerName : chat.sellerName;
                      const roleBadge = isSeller ? 'Buyer' : 'Seller';
                      const hasUnread = isSeller ? chat.unreadForSeller : chat.unreadForBuyer;

                      return (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => handleSelectChat(chat)}
                          className={`w-full text-left p-3 rounded-2xl transition flex items-center gap-3 cursor-pointer border ${
                            hasUnread
                              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                              : 'bg-stone-50/80 dark:bg-slate-800/60 hover:bg-stone-100 dark:hover:bg-slate-800 border-stone-200/80 dark:border-slate-800'
                          }`}
                        >
                          {/* Item Thumbnail / Avatar Stack */}
                          <div className="relative shrink-0">
                            {chat.itemMediaUrl ? (
                              <img
                                src={chat.itemMediaUrl}
                                alt={chat.itemTitle}
                                className="w-12 h-12 rounded-2xl object-cover border border-stone-200 dark:border-slate-700 shadow-2xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-stone-200 dark:bg-slate-700 flex items-center justify-center text-stone-500 dark:text-slate-300">
                                <Tag className="w-5 h-5" />
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-700 text-white font-extrabold text-[9px] flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
                              {otherPartyName.charAt(0)}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-slate-100 truncate">
                                {chat.itemTitle}
                              </p>
                              <span className="text-[10px] font-bold text-stone-400 dark:text-slate-500 shrink-0">
                                {chat.lastMessageTime}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate">
                                {chat.itemPrice}
                              </span>
                              <span className="text-[10px] text-stone-400 dark:text-slate-500">•</span>
                              <span className="text-[11px] font-medium text-stone-600 dark:text-slate-300 truncate">
                                {otherPartyName} ({roleBadge})
                              </span>
                            </div>

                            <p
                              className={`text-xs truncate mt-1 ${
                                hasUnread
                                  ? 'font-bold text-stone-900 dark:text-slate-100'
                                  : 'text-stone-500 dark:text-slate-400'
                              }`}
                            >
                              {chat.lastMessage}
                            </p>
                          </div>

                          {/* Unread indicator dot */}
                          {hasUnread && (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0 shadow-xs" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* ============= THREAD VIEW ============= */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
                {/* Item Summary Subheader - Entire Banner is Tappable to View Listing */}
                <button
                  type="button"
                  onClick={() => {
                    if (onViewItem && selectedChat?.itemId) {
                      onViewItem(selectedChat.itemId);
                    }
                  }}
                  className="w-full p-2.5 rounded-2xl bg-stone-100/90 dark:bg-slate-800/90 hover:bg-stone-200/80 dark:hover:bg-slate-700/80 active:scale-[0.99] border border-stone-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 transition cursor-pointer text-left group mb-2"
                  title="Tap to view item listing"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedChat.itemMediaUrl ? (
                      <img
                        src={selectedChat.itemMediaUrl}
                        alt={selectedChat.itemTitle}
                        className="w-10 h-10 rounded-xl object-cover border border-stone-200 dark:border-slate-700 shrink-0 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-stone-200 dark:bg-slate-700 flex items-center justify-center text-stone-500 dark:text-slate-300 shrink-0">
                        <Tag className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {selectedChat.itemTitle}
                      </p>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {selectedChat.itemPrice}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-stone-500 dark:text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0">
                    <span className="hidden sm:inline">View Listing</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Messages Thread */}
                <div className="flex-1 overflow-y-auto p-2 space-y-3 hide-scrollbar">
                  {(selectedChat.messages || []).map((m) => {
                    const isMe =
                      currentUser &&
                      (String(m.senderId).toLowerCase() === String(currentUser.id).toLowerCase() ||
                        m.senderName.toLowerCase() === currentUser.name.toLowerCase());

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[10px] font-bold text-stone-400 dark:text-slate-500">
                            {isMe ? 'You' : m.senderName}
                          </span>
                          <span className="text-[10px] text-stone-400 dark:text-slate-500">•</span>
                          <span className="text-[10px] text-stone-400 dark:text-slate-500">
                            {m.timestamp}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed shadow-2xs whitespace-pre-line ${
                            isMe
                              ? 'bg-emerald-700 text-white rounded-tr-xs'
                              : 'bg-stone-100 dark:bg-slate-800 text-stone-900 dark:text-slate-100 border border-stone-200 dark:border-slate-700/80 rounded-tl-xs'
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Form Footer */}
                <form
                  onSubmit={handleSendReply}
                  className="pt-2 border-t border-stone-200/80 dark:border-slate-800/80 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a message to buyer/seller..."
                    className="flex-1 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm bg-stone-100/90 dark:bg-slate-800/90 text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 border border-stone-200/80 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="p-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white transition cursor-pointer shrink-0 shadow-2xs flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
