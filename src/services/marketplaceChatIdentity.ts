/** Shared display/protocol semantics. Lossy UID/name aliases are never leave authority. */
export function marketLeft(chat: {
  buyerLeft?: boolean; sellerLeft?: boolean;
  deletedByBuyer?: boolean; deletedBySeller?: boolean; deletedBy?: string[];
}, side: 'buyer' | 'seller') {
  return (side === 'buyer'
    ? chat.buyerLeft === true || chat.deletedByBuyer === true
    : chat.sellerLeft === true || chat.deletedBySeller === true) ||
    (Array.isArray(chat.deletedBy) && chat.deletedBy.includes(side));
}
