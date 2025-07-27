// Notification copy variants for FitCheck
// Each type has multiple variants to rotate through for variety

export interface NotificationVariant {
  title: string;
  body: string;
}

export interface NotificationContext {
  count?: number;
  groupName?: string;
  topUser?: string;
  countMinus1?: number;
  snippet?: string;
  username?: string;
  winnerName?: string;
}

// 1) Daily Post Reminder (only if user hasn't posted)
export const POST_REMINDER: NotificationVariant[] = [
  { title: "You haven't posted today", body: "Post your fit to see everyone else's." },
  { title: "No fit, no leaderboard", body: "Drop something and start climbing." },
];

// 2) Friends Posted – Bundled
export const FRIENDS_POSTED: NotificationVariant[] = [
  { title: "New outfit in {{groupName}}", body: "{{topUser}} and {{countMinus1}} others just posted." },
  { title: "{{groupName}} is active", body: "{{topUser}} and {{countMinus1}} others posted looks." },
];

// 3) Ratings on Your Fit – Bundled
export const RATINGS_BUNDLED: NotificationVariant[] = [
  { title: "{{count}} new ratings on your fit", body: "Where do you sit on the board now?" },
  { title: "You got rated", body: "Check if they loved it or tanked you." },
];

// 4) Comment on Your Fit – Immediate
export const COMMENT: NotificationVariant[] = [
  { title: "New comment on your fit", body: "\"{{snippet}}\"" },
  { title: "{{username}} sounded off on your fit", body: "\"{{snippet}}\"" },
];

// 5) Leaderboard Result / Reset - Winners
export const LEADERBOARD_WINNER: NotificationVariant[] = [
  { title: "You won {{groupName}} ", body: "Defend it tomorrow. Reset just hit." },
  { title: "Top fit of the day = you", body: "Crowned in {{groupName}}. Leaderboard resets now." },
];

// 6) Leaderboard Result / Reset - Non-winners
export const LEADERBOARD_RECAP: NotificationVariant[] = [
  { title: "{{winnerName}} took the crown", body: "New day, fresh board. Post early." },
  { title: "Leaderboard reset", body: "Yesterday's winner: {{winnerName}}" },
];

// 7) New Member Joined Group (optional for MVP)
export const NEW_MEMBER: NotificationVariant[] = [
  { title: "{{username}} joined {{groupName}}", body: "More eyes on your fits." },
  { title: "New member alert", body: "{{username}} just joined {{groupName}}." },
  { title: "Squad's growing", body: "{{username}} pulled up. Post something good." },
];

// Notification types enum
export enum NotificationType {
  POST_REMINDER = 'post_reminder',
  FRIENDS_POSTED = 'friends_posted',
  RATINGS_BUNDLED = 'ratings_bundled',
  COMMENT = 'comment',
  LEADERBOARD_WINNER = 'leaderboard_winner',
  LEADERBOARD_RECAP = 'leaderboard_recap',
  NEW_MEMBER = 'new_member',
}

// Template rendering function
export function renderTemplate(template: string, context: NotificationContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key as keyof NotificationContext];
    return value !== undefined ? String(value) : match;
  });
}

// Pick a random variant from the array
export function pickVariant(type: NotificationType, context: NotificationContext = {}): NotificationVariant {
  let variants: NotificationVariant[];
  
  switch (type) {
    case NotificationType.POST_REMINDER:
      variants = POST_REMINDER;
      break;
    case NotificationType.FRIENDS_POSTED:
      variants = FRIENDS_POSTED;
      break;
    case NotificationType.RATINGS_BUNDLED:
      variants = RATINGS_BUNDLED;
      break;
    case NotificationType.COMMENT:
      variants = COMMENT;
      break;
    case NotificationType.LEADERBOARD_WINNER:
      variants = LEADERBOARD_WINNER;
      break;
    case NotificationType.LEADERBOARD_RECAP:
      variants = LEADERBOARD_RECAP;
      break;
    case NotificationType.NEW_MEMBER:
      variants = NEW_MEMBER;
      break;
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
  
  // Pick random variant
  const randomIndex = Math.floor(Math.random() * variants.length);
  const variant = variants[randomIndex];
  
  // Render template with context
  return {
    title: renderTemplate(variant.title, context),
    body: renderTemplate(variant.body, context),
  };
}

// Helper function to truncate text for snippets
export function truncateText(text: string, maxLength: number = 40): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
} 