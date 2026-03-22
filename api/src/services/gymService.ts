import { pool } from '../db/pool';

interface GymRow {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  default_retirement_days: number;
  created_at: string;
}

export async function listAll(): Promise<GymRow[]> {
  const { rows } = await pool.query<GymRow>(
    'SELECT id, name, city, lat, lng, default_retirement_days, created_at FROM gyms ORDER BY name',
  );
  return rows;
}
