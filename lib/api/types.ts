export type JWTPayload = {
    token: string;
    user_email: string;
    user_nicename: string;
    user_display_name: string;
  };
  
  export type MembershipResp = { is_member: boolean; user_id?: number; roles?: string[] };
  export type WPPage = { id: number; slug: string; content: { rendered: string } };
  export type WPPost = { id: number; date: string; title: { rendered: string }; excerpt?: { rendered: string }; _embedded?: any };
  
  export type WPUserMe = { id: number; name: string; email?: string; username?: string; roles?: string[] };
  
  // BuddyPress
  export type BPActivity = {
    id: number;
    user_id: number;
    component: string;
    type: string;
    date: string;
    content?: { rendered?: string } | string;
  };
  
  export type BPMember = {
    id: number;
    name?: string;
    avatar_urls?: { full?: string; thumb?: string };
  };
  
  export type ActivityItem = {
    id: number;
    user_id: number;
    date: string;
    html: string;
    favorited?: boolean;
    favorite_count?: number;
    comment_count?: number;
  };