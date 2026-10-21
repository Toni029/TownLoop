export interface MarketplaceChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  createdAt?: number;
  isSystem?: boolean;
}

export interface MarketplaceChat {
  id: string;
  itemId: string;
  itemTitle: string;
  itemPrice: string;
  itemMediaUrl?: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  sellerApt?: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  buyerApt?: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageTime: string;
  updatedAt: number;
  unreadForSeller?: boolean;
  unreadForBuyer?: boolean;
  deletedByBuyer?: boolean;
  deletedBySeller?: boolean;
  buyerLeft?: boolean;
  sellerLeft?: boolean;
  deletedBy?: string[];
  messages: MarketplaceChatMessage[];
}
