/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { AddTaskModal } from './tasks/AddTaskModal';
import { TaskCalendarModal } from './tasks/TaskCalendarModal';
import { WorkOrderModal } from './workorders/WorkOrderModal';
import { CreatePostModal } from './CreatePostModal';
import { PostDetailModal } from './PostDetailModal';
import { MessageSellerModal } from './MessageSellerModal';
import { MarketplaceChatModal } from './community/MarketplaceChatModal';
import { NewsletterModal } from './NewsletterModal';
import { MediaFullscreenModal } from './MediaFullscreenModal';
import { canDeleteAnyPost, canManageNewsletter } from '../utils/permissions';
import type { HomeState } from '../hooks/useHomeState';
import type { PortalDatesState } from '../hooks/usePortalDates';
import type { WorkOrdersState } from '../hooks/useWorkOrders';
import type { NewsState } from '../hooks/useNewsState';
import type { CommunityState } from '../hooks/useCommunityState';
import type { AppToastState } from '../hooks/useAppToast';

interface PortalModalsProps {
  home: HomeState;
  dates: PortalDatesState;
  workOrders: WorkOrdersState;
  news: NewsState;
  community: CommunityState;
  notifications: AppToastState;
}

export function PortalModals({
  home,
  dates,
  workOrders,
  news,
  community,
  notifications,
}: PortalModalsProps) {
  const { currentMonthEdition } = dates;
  const { isAddTaskModalOpen, isCalendarModalOpen } = home;
  const { isWorkOrderModalOpen } = workOrders;
  const { isPdfModalOpen, setIsPdfModalOpen } = news;
  const { toastMessage } = notifications;
  const {
    socialView,
    isCreatePostModalOpen,
    setIsCreatePostModalOpen,
    selectedDetailPost,
    setSelectedDetailPost,
    selectedDetailMarket,
    setSelectedDetailMarket,
    selectedMessageSellerItem,
    setSelectedMessageSellerItem,
    isMessageSellerModalOpen,
    setIsMessageSellerModalOpen,
    fullscreenMedia,
    setFullscreenMedia,
    toggleLike,
    handleModalAddComment,
    isItemCreator,
    handleToggleSoldItem,
    handleDeleteItem,
    handleOpenMessageSeller,
    handleSendMessageToSeller,
    handleCreatePostSubmit,
  } = community;

  return (
    <>
      {/* Modal: Add Task */}
      <AnimatePresence>
        {isAddTaskModalOpen && <AddTaskModal {...home} />}
      </AnimatePresence>

      {/* Modal: Calendar - Choose Any Day & Navigate Months */}
      <AnimatePresence>
        {isCalendarModalOpen && <TaskCalendarModal {...home} {...dates} />}
      </AnimatePresence>

      {/* Modal: New Work Order */}
      <AnimatePresence>
        {isWorkOrderModalOpen && (
          <WorkOrderModal
            {...workOrders}
            currentUser={community.currentUser}
          />
        )}
      </AnimatePresence>

      {/* Modal: Create Community Post with Image & Video Uploads */}
      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => setIsCreatePostModalOpen(false)}
        defaultType={socialView}
        currentUser={community.currentUser}
        onSubmit={handleCreatePostSubmit}
      />

      {/* Modal: Post Detail View (Open post & see full pictures/videos and neighbor comments) */}
      <PostDetailModal
        isOpen={!!selectedDetailPost || !!selectedDetailMarket}
        onClose={() => {
          setSelectedDetailPost(null);
          setSelectedDetailMarket(null);
        }}
        post={selectedDetailPost}
        marketItem={selectedDetailMarket}
        isOwner={isItemCreator(selectedDetailMarket || selectedDetailPost) || canDeleteAnyPost(community.currentUser)}
        onToggleLikePost={toggleLike}
        onAddComment={handleModalAddComment}
        onToggleSoldMarketItem={handleToggleSoldItem}
        onMessageSeller={handleOpenMessageSeller}
        onDeletePost={handleDeleteItem}
      />

      {/* Modal: Message Seller */}
      <MessageSellerModal
        isOpen={isMessageSellerModalOpen}
        onClose={() => {
          setIsMessageSellerModalOpen(false);
          setSelectedMessageSellerItem(null);
        }}
        item={selectedMessageSellerItem}
        onSendMessage={handleSendMessageToSeller}
        currentUser={community.currentUser}
      />

      {/* Modal: Marketplace Chat Inbox */}
      <MarketplaceChatModal
        isOpen={community.isMarketplaceChatModalOpen}
        onClose={() => community.setIsMarketplaceChatModalOpen(false)}
        chats={community.marketplaceChats}
        currentUser={community.currentUser}
        activeChatId={community.activeMarketplaceChatId}
        onSelectChat={(id) => community.setActiveMarketplaceChatId(id)}
        onDeleteChat={(chatId) => {
          community.setMarketplaceChats((prev) => prev.filter((c) => c.id !== chatId));
        }}
        onViewItem={(itemId) => {
          community.setIsMarketplaceChatModalOpen(false);
          const found = community.marketItems.find((it) => String(it.id) === String(itemId));
          if (found) {
            community.setSelectedDetailMarket(found);
          }
        }}
      />

      {/* Global Toast Notification with Native iOS Spring Physics */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="global-toast-notification"
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.94 }}
            transition={{ type: 'spring', damping: 26, stiffness: 480, mass: 0.35 }}
            className="fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-stone-900/95 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-stone-700/60 flex items-center gap-2 pointer-events-none max-w-[90vw]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Newsletter PDF Viewer */}
      <NewsletterModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        monthEdition={currentMonthEdition}
        newsletterConfig={news.newsletterConfig}
        onOpenUploadModal={() => news.setIsUploadNewsletterModalOpen(true)}
        onRemoveNewsletter={news.handleRemoveNewsletter}
        onReanalyzeNewsletter={news.handleReanalyzeNewsletter}
        isReanalyzingAi={news.isReanalyzingAi}
        canManage={canManageNewsletter(community.currentUser)}
      />

      {/* Fullscreen Media Lightbox with Pinch-to-Zoom */}
      <MediaFullscreenModal
        isOpen={!!fullscreenMedia}
        onClose={() => setFullscreenMedia(null)}
        media={fullscreenMedia?.media || []}
        initialIndex={fullscreenMedia?.initialIndex}
        title={fullscreenMedia?.title}
        author={fullscreenMedia?.author}
      />
    </>
  );
}
