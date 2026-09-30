/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState } from 'react';
import { MessageSquare, Maximize2, Trash2 } from 'lucide-react';
import type { CommunityState } from '../../hooks/useCommunityState';
import { canDeleteAnyPost } from '../../utils/permissions';
import { UserAvatar } from '../UserAvatar';

type DiscussionFeedProps = Pick<
  CommunityState,
  | 'currentUser'
  | 'posts'
  | 'isItemCreator'
  | 'handleDeleteItem'
  | 'setSelectedDetailPost'
  | 'setFullscreenMedia'
  | 'toggleLike'
  | 'setOpenCommentsPostId'
  | 'openCommentsPostId'
  | 'commentInputText'
  | 'setCommentInputText'
  | 'handleAddComment'
>;

export function DiscussionFeed({
  currentUser,
  posts,
  isItemCreator,
  handleDeleteItem,
  setSelectedDetailPost,
  setFullscreenMedia,
  toggleLike,
  setOpenCommentsPostId,
  openCommentsPostId,
  commentInputText,
  setCommentInputText,
  handleAddComment,
}: DiscussionFeedProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);

  return (
    <div className="space-y-3.5">
      {posts.map((post) => {
        const canDelete = canDeleteAnyPost(currentUser) || isItemCreator?.(post);
        const postMedia = (post.media && post.media.length > 0)
          ? post.media
          : post.mediaUrl
            ? [{ type: 'image' as const, url: post.mediaUrl, name: post.title }]
            : [];

        const isMyPost = Boolean(
          currentUser &&
          ((post.authorId && String(post.authorId) === String(currentUser.id)) ||
           (post.author && currentUser.name && post.author.toLowerCase() === currentUser.name.toLowerCase()) ||
           (post.authorEmail && currentUser.email && post.authorEmail.toLowerCase() === currentUser.email.toLowerCase()))
        );
        const effectiveAuthorAvatar = (isMyPost && currentUser?.avatarUrl) ? currentUser.avatarUrl : post.authorAvatar;

        return (
          <div
            key={post.id}
            className="bg-white dark:bg-slate-900/80 border border-stone-200/80 dark:border-slate-800 rounded-[24px] p-4 space-y-3 shadow-xs hover:shadow-md hover:border-stone-300 dark:hover:border-slate-700 transition group"
          >
            {/* Post Header */}
            <div className="flex items-center justify-between">
              <div
                onClick={() => setSelectedDetailPost(post)}
                className="flex items-center space-x-2.5 cursor-pointer"
              >
                <UserAvatar
                  src={effectiveAuthorAvatar}
                  name={post.author}
                  size="sm"
                  className="w-9 h-9 border border-emerald-600/30 dark:border-emerald-600/40"
                />
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                    {post.author}
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-slate-500">{post.timeAgo}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded-full border border-stone-200 dark:border-slate-700">
                  {post.tag}
                </span>

                {/* Trash can icon to delete post (Admin, VIP, or Author) */}
                {canDelete && (
                  confirmDeleteId === post.id ? (
                    <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg px-2 py-0.5">
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">Delete?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(post.id, false);
                          setConfirmDeleteId(null);
                        }}
                        className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-1.5 py-0.5 rounded"
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="text-[10px] text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(post.id);
                      }}
                      title="Delete post (Admin/VIP/Author)"
                      className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>

          {/* Post Title & Content clickable to open detail view */}
          <div
            onClick={() => setSelectedDetailPost(post)}
            className="cursor-pointer space-y-1.5"
          >
            <h4 className="font-bold text-stone-900 dark:text-slate-100 text-sm group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition">
              {post.title}
            </h4>
            <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed line-clamp-3">
              {post.content}
            </p>
          </div>

          {/* Media preview if attached */}
          {postMedia.length > 0 && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setFullscreenMedia({
                  media: postMedia,
                  initialIndex: 0,
                  title: post.title,
                  author: post.author,
                });
              }}
              className="cursor-pointer relative rounded-2xl overflow-hidden bg-stone-900 aspect-video max-h-48 border border-stone-200 shadow-2xs group/media hover:ring-2 hover:ring-emerald-600/40 transition"
              title="Click to view full screen with pinch-to-zoom"
            >
              {postMedia[0].type === 'image' ? (
                <img
                  src={postMedia[0].url}
                  alt="attached media"
                  className="w-full h-full object-cover group-hover/media:scale-102 transition duration-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center relative bg-stone-950">
                  <video
                    src={postMedia[0].url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/90 text-stone-900 flex items-center justify-center shadow-md">
                      <span className="text-xs font-bold pl-0.5">▶</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Screen Badge in corner */}
              <div className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-xs transition">
                <Maximize2 className="w-3 h-3" />
                <span>Full Screen</span>
              </div>

              {postMedia.length > 1 && (
                <span className="absolute bottom-2 right-2 bg-stone-950/75 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-xs">
                  +{postMedia.length - 1} more
                </span>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
            <button
              onClick={() => toggleLike(post.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition font-medium ${
                post.liked
                  ? 'text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60'
                  : 'hover:text-rose-600 hover:bg-stone-50 dark:hover:bg-slate-800 dark:hover:text-rose-400'
              }`}
            >
              <span>{post.liked ? '❤️' : '🤍'}</span>
              <span>{post.likes}</span>
            </button>

            <button
              onClick={() =>
                setOpenCommentsPostId(
                  openCommentsPostId === post.id ? null : post.id
                )
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-600 dark:text-slate-400 font-medium transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 stroke-current" />
              <span>
                {post.comments.length}{' '}
                {post.comments.length === 1 ? 'Comment' : 'Comments'}
              </span>
            </button>
          </div>

          {/* Improved Inline Comments Section */}
          {openCommentsPostId === post.id && (
            <div className="mt-2 pt-3 border-t border-dashed border-stone-200 dark:border-slate-800 space-y-2.5">
              {post.comments.length === 0 ? (
                <p className="text-[11px] text-stone-400 dark:text-slate-500 italic text-center py-2">
                  No comments yet. Start the conversation!
                </p>
              ) : (
                <div className="space-y-2">
                  {post.comments.map((c) => {
                    const isMyComment = Boolean(
                      currentUser &&
                      ((c.authorId && String(c.authorId) === String(currentUser.id)) ||
                       (c.author && currentUser.name && c.author.toLowerCase() === currentUser.name.toLowerCase()) ||
                       (c.authorEmail && currentUser.email && c.authorEmail.toLowerCase() === currentUser.email.toLowerCase()))
                    );
                    const effectiveCommentAvatar = (isMyComment && currentUser?.avatarUrl) ? currentUser.avatarUrl : c.authorAvatar;

                    return (
                      <div
                        key={c.id}
                        className="bg-stone-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-stone-200/60 dark:border-slate-700/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <UserAvatar
                              src={effectiveCommentAvatar}
                              name={c.author}
                              size="xs"
                              className="w-5 h-5 text-[9px]"
                            />
                          <span className="font-bold text-stone-800 dark:text-slate-200">
                            {c.author}
                          </span>
                          {c.unit && (
                            <span className="text-[10px] text-stone-400 dark:text-slate-500 font-normal">
                              ({c.unit})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-400 dark:text-slate-500">
                          {c.timeAgo}
                        </span>
                      </div>
                      <p className="text-stone-700 dark:text-slate-300 pl-6 leading-relaxed">
                        {c.text}
                      </p>
                    </div>
                  );
                })}
              </div>
              )}

              <div className="flex gap-1.5 pt-1">
                <input
                  value={commentInputText[post.id] || ''}
                  onChange={(e) =>
                    setCommentInputText({
                      ...commentInputText,
                      [post.id]: e.target.value,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddComment(post.id);
                  }}
                  placeholder="Write a comment to Martha and neighbors..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-emerald-600"
                />
                <button
                  onClick={() => handleAddComment(post.id)}
                  disabled={!(commentInputText[post.id] || '').trim()}
                  className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  Reply
                </button>
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
);
}
