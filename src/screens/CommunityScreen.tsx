/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React from 'react';
import { Plus, MessageSquare, Tag, Mail } from 'lucide-react';
import type { CommunityState } from '../hooks/useCommunityState';
import { DiscussionFeed } from '../components/community/DiscussionFeed';
import { Marketplace } from '../components/community/Marketplace';
import { canCreatePost } from '../utils/permissions';

type CommunityScreenProps = Pick<
  CommunityState,
  | 'currentUser'
  | 'setIsCreatePostModalOpen'
  | 'socialView'
  | 'setSocialView'
  | 'posts'
  | 'marketItems'
  | 'setSelectedDetailPost'
  | 'setFullscreenMedia'
  | 'toggleLike'
  | 'setOpenCommentsPostId'
  | 'openCommentsPostId'
  | 'commentInputText'
  | 'setCommentInputText'
  | 'handleAddComment'
  | 'isItemCreator'
  | 'handleDeleteItem'
  | 'setSelectedDetailMarket'
  | 'handleToggleSoldItem'
  | 'handleOpenMessageSeller'
  | 'marketplaceChats'
  | 'setIsMarketplaceChatModalOpen'
>;

export const CommunityScreen = React.memo(function CommunityScreen({
  currentUser,
  setIsCreatePostModalOpen,
  socialView,
  setSocialView,
  posts,
  marketItems,
  setSelectedDetailPost,
  setFullscreenMedia,
  toggleLike,
  setOpenCommentsPostId,
  openCommentsPostId,
  commentInputText,
  setCommentInputText,
  handleAddComment,
  isItemCreator,
  handleDeleteItem,
  setSelectedDetailMarket,
  handleToggleSoldItem,
  handleOpenMessageSeller,
  marketplaceChats,
  setIsMarketplaceChatModalOpen,
}: CommunityScreenProps) {
  const allowCreatePost = canCreatePost(currentUser);

  const unreadMarketplaceCount = (marketplaceChats || []).filter((c) => {
    const isSeller =
      currentUser &&
      (String(currentUser.id).toLowerCase() === String(c.sellerId).toLowerCase() ||
        currentUser.name.toLowerCase() === c.sellerName.toLowerCase());
    return isSeller ? c.unreadForSeller : c.unreadForBuyer;
  }).length;

  return (
    <section className="space-y-4 animate-in fade-in duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 serif-title">
            Community
          </h2>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            Neighbors, conversations & marketplace
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Marketplace Inbox Mail Button sitting next to + New listing */}
          {socialView === 'market' && (
            <button
              type="button"
              id="open-marketplace-chats-btn"
              onClick={() => setIsMarketplaceChatModalOpen(true)}
              className="relative bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-800 dark:text-slate-100 border border-stone-300/80 dark:border-slate-700 p-2 sm:px-3.5 sm:py-2 rounded-2xl flex items-center gap-1.5 font-bold text-xs sm:text-sm transition cursor-pointer shadow-2xs active:scale-95"
              title="Marketplace Chats & Inbox"
            >
              <Mail className="w-4 h-4 text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
              <span className="hidden sm:inline">Marketplace Chats</span>
              {unreadMarketplaceCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadMarketplaceCount}
                </span>
              )}
            </button>
          )}

          {/* Every role (Admin, VIP, Crew, Resident) can post and create listings */}
          {allowCreatePost && (
            <button
              id="create-new-post-btn"
              onClick={() => setIsCreatePostModalOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 active:scale-92 active:rotate-[-1deg] text-white font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-2xl flex items-center gap-1.5 shadow-xs hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{socialView === 'market' ? 'New listing' : 'New post'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex bg-stone-200/80 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-semibold">
        <button
          onClick={() => setSocialView('chat')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            socialView === 'chat'
              ? 'bg-white dark:bg-slate-900 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs'
              : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Discussion Feed ({posts.length})</span>
        </button>
        <button
          onClick={() => setSocialView('market')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            socialView === 'market'
              ? 'bg-white dark:bg-slate-900 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs'
              : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Buy / Sell / Free ({marketItems.length})</span>
        </button>
      </div>

      {/* Discussion View */}
      {socialView === 'chat' && (
        <DiscussionFeed
          posts={posts}
          currentUser={currentUser}
          isItemCreator={isItemCreator}
          handleDeleteItem={handleDeleteItem}
          setSelectedDetailPost={setSelectedDetailPost}
          setFullscreenMedia={setFullscreenMedia}
          toggleLike={toggleLike}
          setOpenCommentsPostId={setOpenCommentsPostId}
          openCommentsPostId={openCommentsPostId}
          commentInputText={commentInputText}
          setCommentInputText={setCommentInputText}
          handleAddComment={handleAddComment}
        />
      )}

      {/* Marketplace View */}
      {socialView === 'market' && (
        <Marketplace
          marketItems={marketItems}
          currentUser={currentUser}
          isItemCreator={isItemCreator}
          handleDeleteItem={handleDeleteItem}
          setFullscreenMedia={setFullscreenMedia}
          setSelectedDetailMarket={setSelectedDetailMarket}
          handleToggleSoldItem={handleToggleSoldItem}
          handleOpenMessageSeller={handleOpenMessageSeller}
        />
      )}
    </section>
  );
});
