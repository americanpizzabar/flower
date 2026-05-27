export type LocalizedString = Record<string, string>;
export type LocalizedList = Record<string, string[]>;

export interface BirthDay {
  month: number;
  day: number;
}

export type Season = "spring" | "early_summer" | "summer" | "autumn" | "winter";

export interface Flower {
  id: number;
  slug: string;
  names: LocalizedString;
  meanings: LocalizedList;
  birth_days: BirthDay[];
  seasons: Season[];
  default_color: string | null;
  image_url: string | null;
  notes: string | null;
}

export interface InventoryItem {
  id: number;
  flower_id: number;
  color: string | null;
  stock: number;
  received_at: string;
  price: number | null;
  photo_url: string | null;
  note: string | null;
  updated_at: string;
}

export interface InventoryItemWithFlower extends InventoryItem {
  flower: Flower;
}

export interface ChatTurn {
  role: "customer" | "staff";
  text: string;
  language?: string;
  translation_ja?: string;
}

export interface ChatResponse {
  detected_language: string;
  language_name_ja: string;
  translated_for_staff_ja: string;
  reply_to_customer: string;
  suggested_inventory_ids: number[];
  reason_ja: string;
}

export interface SuggestResponse {
  matches: InventoryItemWithFlower[];
  comment_ja: string;
}
