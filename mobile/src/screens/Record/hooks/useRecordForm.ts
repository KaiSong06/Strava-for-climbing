import { useCallback, useState } from 'react';
import { MAX_PHOTOS, type Project } from '../constants';

export interface RecordPhoto {
  uri: string;
}

export interface UseRecordFormResult {
  project: string | null;
  setProject: (id: string | null) => void;
  photos: RecordPhoto[];
  setPhotos: (photos: RecordPhoto[] | ((prev: RecordPhoto[]) => RecordPhoto[])) => void;
  addPhotos: (added: RecordPhoto[]) => void;
  removePhoto: (index: number) => void;
  holdColor: string | null;
  setHoldColor: (hex: string | null) => void;
  difficulty: string | null;
  setDifficulty: (grade: string | null) => void;
  customProjects: Project[];
  addCustomProject: (label: string) => string | null;
  resetForm: () => void;
  isPostEnabled: (gymId: string | null) => boolean;
}

/**
 * Form state for RecordScreen — photos, project, hold colour, difficulty and custom projects.
 *
 * All setters are stable via useCallback. The derived `isPostEnabled` check is a function of
 * the current gymId (taken from the auth store at call site) so this hook does not need to
 * subscribe to it directly.
 */
export function useRecordForm(): UseRecordFormResult {
  const [project, setProject] = useState<string | null>(null);
  const [photos, setPhotos] = useState<RecordPhoto[]>([]);
  const [holdColor, setHoldColor] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [customProjects, setCustomProjects] = useState<Project[]>([]);

  const addPhotos = useCallback((added: RecordPhoto[]) => {
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addCustomProject = useCallback((label: string): string | null => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const id = `custom-${Date.now()}`;
    setCustomProjects((prev) => [...prev, { id, label: trimmed }]);
    setProject(id);
    return id;
  }, []);

  const resetForm = useCallback(() => {
    setProject(null);
    setPhotos([]);
    setHoldColor(null);
    setDifficulty(null);
  }, []);

  const isPostEnabled = useCallback(
    (gymId: string | null) => photos.length >= 1 && holdColor !== null && gymId !== null,
    [photos.length, holdColor],
  );

  return {
    project,
    setProject,
    photos,
    setPhotos,
    addPhotos,
    removePhoto,
    holdColor,
    setHoldColor,
    difficulty,
    setDifficulty,
    customProjects,
    addCustomProject,
    resetForm,
    isPostEnabled,
  };
}
