import test from "node:test";
import assert from "node:assert/strict";
import {
  readPost,
  readListing,
  readChat,
  mediaFor,
  owns,
  withAvatar,
  appendComment,
  formatPrice,
  visibleChat,
  hasLeft,
  orderedChats,
} from "../src/social/model.ts";
import { LikeStore } from "../src/social/likes.ts";
test("Social reads the existing collection fields and keeps all media and comment identity", () => {
  const p = readPost("post", {
    userId: "resident",
    content: "Existing",
    likes: 3,
    media: [
      { type: "image", url: "one" },
      { type: "video", url: "two" },
    ],
    comments: [{ id: "comment", userId: "neighbor", text: "Reply" }],
  });
  assert.equal(p.authorId, "resident");
  assert.equal(p.likes, 3);
  assert.equal(p.liked, false);
  assert.equal(p.media?.length, 2);
  assert.equal(p.comments[0].authorId, "neighbor");
  assert.deepEqual(mediaFor({ mediaUrl: "legacy" }), [
    { type: "image", url: "legacy" },
  ]);
  const listing = readListing("listing", {
    claimed: true,
    price: "FREE",
    userId: "seller",
    mediaUrl: "picture",
  });
  assert.equal(listing.sold, true);
  assert.equal(listing.claimed, true);
  assert.equal(listing.authorId, "seller");
});
test("ownership and live avatars use resident identity, preserving same-name neighbors", () => {
  const user = {
    id: "one",
    name: "Same Name",
    email: "one@example.invalid",
    avatarUrl: "new-avatar",
  };
  const post = readPost("post", {
    userId: "two",
    author: "Same Name",
    authorAvatar: "other-avatar",
    comments: [
      {
        id: "c",
        authorId: "one",
        author: "Same Name",
        text: "Comment",
        authorAvatar: "old-avatar",
      },
    ],
  });
  assert.equal(owns(post, user), false);
  assert.equal(withAvatar(post, [], user).authorAvatar, "other-avatar");
  assert.equal(
    withAvatar(post, [], user).comments[0].authorAvatar,
    "new-avatar",
  );
});
test("comment retry is idempotent and price formatting matches the existing form", () => {
  const c = {
    id: "same",
    author: "Resident",
    text: "Reply",
    timeAgo: "Just now",
  };
  assert.equal(appendComment([c], c).length, 1);
  assert.equal(appendComment([c], { ...c, id: "other" }).length, 2);
  assert.equal(formatPrice(""), "FREE");
  assert.equal(formatPrice("free"), "FREE");
  assert.equal(formatPrice("25"), "$25");
  assert.equal(formatPrice("$30"), "$30");
});
test("marketplace inbox shows only the caller’s conversations and preserves leave flags", () => {
  const chat = readChat("chat", {
    sellerId: "seller",
    sellerName: "Same Name",
    buyerId: "buyer",
    buyerName: "Same Name",
    messages: [],
  });
  assert.equal(visibleChat(chat, "outsider"), false);
  assert.equal(visibleChat(chat, "seller"), true);
  assert.equal(visibleChat({ ...chat, buyerLeft: true }, "seller"), true);
  assert.equal(visibleChat({ ...chat, buyerLeft: true }, "buyer"), false);
  assert.equal(hasLeft({ ...chat, deletedBy: ["seller"] }, "seller"), true);
});
test("reaction membership persists across restart and is isolated per resident", async () => {
  const records = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => records.get(k) || null,
    setItem: async (k: string, v: string) => {
      records.set(k, v);
    },
  };
  const one = new LikeStore("one", storage),
    two = new LikeStore("two", storage);
  await one.load();
  await two.load();
  await one.save("post", true);
  assert.equal(two.values.has("post"), false);
  const restart = new LikeStore("one", storage);
  await restart.load();
  assert.equal(restart.values.has("post"), true);
  await restart.save("post", false);
  assert.equal(restart.values.size, 0);
});
test("failed local reaction saves retry without changing the acknowledged remote action", async () => {
  let fail = true,
    writes = 0;
  const store = new LikeStore("one", {
    getItem: async () => null,
    setItem: async () => {
      writes++;
      if (fail) throw Error();
    },
  });
  await store.load();
  await store.save("post", true);
  assert.equal(store.values.has("post"), true);
  assert.equal(store.dirty, true);
  assert.ok(store.error);
  fail = false;
  await store.retry();
  assert.equal(store.error, "");
  assert.equal(store.dirty, false);
  assert.equal(writes, 2);
});
test("corrupt reaction data is reported and never overwritten before recovery", async () => {
  let writes = 0;
  const store = new LikeStore("one", {
    getItem: async () => "{bad",
    setItem: async () => {
      writes++;
    },
  });
  await store.load();
  assert.equal(store.ready, false);
  assert.ok(store.error);
  await assert.rejects(store.save("post", true));
  assert.equal(writes, 0);
});

test("inbox ordering preserves legacy chats without timestamps and hides other residents", () => {
  const chats = [
    readChat("legacy", { sellerId: "seller", buyerId: "buyer" }),
    readChat("new", {
      sellerId: "seller",
      buyerId: "buyer",
      updatedAt: { toMillis: () => 500 },
    }),
    readChat("other", {
      sellerId: "someone",
      buyerId: "else",
      updatedAt: 1000,
    }),
  ];
  assert.deepEqual(
    orderedChats(chats, "buyer").map((c) => c.id),
    ["new", "legacy"],
  );
  assert.equal(chats[0].id, "legacy");
});
