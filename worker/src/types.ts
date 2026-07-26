export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TELEGRAM_WEBHOOK_SECRET: string;
  ALLOWED_TELEGRAM_USER_ID: string;
  TELEGRAM_BOT_TOKEN: string;
  DASHBOARD_USERNAME: string;
  DASHBOARD_PASSWORD: string;
}

export interface TelegramUpdate { update_id: number; message?: TelegramMessage; }
export interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  from?: { id: number; is_bot?: boolean };
  chat: { id: number; type: string };
}

export type PrimaryCategory = "Procurement" | "Admin & Finance" | "Communication & Follow-Up" |
  "Scheduling & Coordination" | "Project Work" | "Problems to Solve" |
  "Research / Figure Out" | "General Task";
export type Domain = "Business" | "Personal" | "Home" | "Health" | "Family" | "Learning";
export type RequestedBy = "Self" | "Dan" | "Customer" | "Team" | "Vendor" | "System" | "Other";
export type ItemFlag = "Urgent" | "Time-Sensitive" | "Waiting On" | "Quick Task" | "Deep Work";
export type ItemStatus = "Inbox" | "Open" | "Waiting" | "Done" | "Archived";
