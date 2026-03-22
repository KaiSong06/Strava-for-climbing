// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id: string | null;
  created_at: string;
}

/** Returned by GET /users/me and GET /users/:username */
export interface UserProfile extends User {
  home_gym_name: string | null;
  follower_count: number;
  following_count: number;
}

/** Returned by auth endpoints and GET /users/me (includes email) */
export interface AuthUser extends UserProfile {
  email: string;
}

// ─── Gyms ─────────────────────────────────────────────────────────────────────

export interface Gym {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  default_retirement_days: number;
  created_at: string;
}

// ─── Problems ─────────────────────────────────────────────────────────────────

export type ProblemStatus = 'active' | 'retired';

export interface Problem {
  id: string;
  gym_id: string;
  colour: string;
  /** Stored as vector(200) in pgvector; padded with zeros to 200 dims (100 holds max) */
  hold_vector: number[] | null;
  model_url: string | null;
  status: ProblemStatus;
  consensus_grade: string | null;
  total_sends: number;
  first_upload_at: string;
  retired_at: string | null;
  created_at: string;
}

// ─── Ascents ──────────────────────────────────────────────────────────────────

export type AscentType = 'flash' | 'send' | 'attempt';
export type AscentVisibility = 'public' | 'friends' | 'private';

export interface Ascent {
  id: string;
  user_id: string;
  problem_id: string;
  type: AscentType;
  user_grade: string | null;
  rating: number | null; // 1–5
  visibility: AscentVisibility;
  logged_at: string;
  created_at: string;
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

export type ProcessingStatus = 'pending' | 'processing' | 'matched' | 'unmatched' | 'failed';

export interface Upload {
  id: string;
  user_id: string;
  problem_id: string | null;
  photo_urls: string[];
  processing_status: ProcessingStatus;
  similarity_score: number | null;
  created_at: string;
}

// ─── Follows ──────────────────────────────────────────────────────────────────

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

// ─── Match Disputes ───────────────────────────────────────────────────────────

export type DisputeStatus = 'open' | 'resolved_confirm' | 'resolved_split';

export interface MatchDispute {
  id: string;
  upload_id: string;
  reported_by: string;
  status: DisputeStatus;
  votes_confirm: number;
  votes_split: number;
  created_at: string;
}

// ─── API response helpers ─────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  has_more: boolean;
}
