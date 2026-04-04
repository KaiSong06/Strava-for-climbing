jest.mock('../db/pool', () => require('../test/dbMock').poolModule);

import { mockQuery, resetMock } from '../test/dbMock';
import {
  createProblem,
  getProblemWithGym,
  calculateConsensusGrade,
  incrementTotalSends,
} from './problemService';
import { AppError } from '../middleware/errorHandler';

beforeEach(resetMock);

describe('createProblem', () => {
  it('should pad hold_vector to 200 dimensions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'prob-1' }], rowCount: 1 });

    await createProblem('gym-1', 'red', [0.1, 0.2, 0.3, 0.4]);

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    const vectorStr = call![1]![2] as string;
    // Should be padded: 4 real values + 196 zeros = 200 total
    const nums = vectorStr.replace(/[[\]]/g, '').split(',');
    expect(nums).toHaveLength(200);
    expect(nums[0]).toBe('0.1');
    expect(nums[3]).toBe('0.4');
    expect(nums[4]).toBe('0');
    expect(nums[199]).toBe('0');
  });

  it('should truncate hold_vector longer than 200 dims', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'prob-2' }], rowCount: 1 });

    const longVector = Array.from({ length: 250 }, (_, i) => i * 0.01);
    await createProblem('gym-1', 'blue', longVector);

    const call = mockQuery.mock.calls[0];
    const vectorStr = call![1]![2] as string;
    const nums = vectorStr.replace(/[[\]]/g, '').split(',');
    expect(nums).toHaveLength(200);
  });

  it('should throw AppError when INSERT returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(createProblem('gym-1', 'red', [1, 2])).rejects.toThrow(AppError);
  });
});

describe('getProblemWithGym', () => {
  it('should return problem with gym name', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'p-1',
          gym_id: 'g-1',
          colour: 'green',
          status: 'active',
          consensus_grade: 'V3',
          total_sends: 12,
          first_upload_at: '2026-01-01',
          gym_name: 'Allez Up',
        },
      ],
      rowCount: 1,
    });

    const result = await getProblemWithGym('p-1');

    expect(result.id).toBe('p-1');
    expect(result.gym_name).toBe('Allez Up');
    expect(result.colour).toBe('green');
  });

  it('should throw NOT_FOUND when problem does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(getProblemWithGym('missing')).rejects.toThrow(AppError);
  });
});

describe('calculateConsensusGrade', () => {
  it('should pick median grade from odd number of grades', async () => {
    // SELECT user_grade FROM ascents
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_grade: 'V3' },
        { user_grade: 'V5' },
        { user_grade: 'V4' },
      ],
      rowCount: 3,
    });
    // UPDATE problems SET consensus_grade
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await calculateConsensusGrade('prob-1');

    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall).toBeDefined();
    // Sorted: V3, V4, V5 -> median index 1 -> V4
    expect(updateCall![1]![0]).toBe('V4');
    expect(updateCall![1]![1]).toBe('prob-1');
  });

  it('should pick upper-median grade from even number of grades', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_grade: 'V2' },
        { user_grade: 'V4' },
        { user_grade: 'V3' },
        { user_grade: 'V5' },
      ],
      rowCount: 4,
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await calculateConsensusGrade('prob-2');

    const updateCall = mockQuery.mock.calls[1];
    // Sorted: V2, V3, V4, V5 -> Math.floor(4/2) = index 2 -> V4
    expect(updateCall![1]![0]).toBe('V4');
  });

  it('should handle VB grade correctly (sorts lowest)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_grade: 'V1' },
        { user_grade: 'VB' },
        { user_grade: 'V0' },
      ],
      rowCount: 3,
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await calculateConsensusGrade('prob-3');

    const updateCall = mockQuery.mock.calls[1];
    // Sorted: VB (-1), V0 (0), V1 (1) -> median index 1 -> V0
    expect(updateCall![1]![0]).toBe('V0');
  });

  it('should handle plus grades correctly', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_grade: 'V5' },
        { user_grade: 'V5+' },
        { user_grade: 'V6' },
      ],
      rowCount: 3,
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await calculateConsensusGrade('prob-4');

    const updateCall = mockQuery.mock.calls[1];
    // Sorted: V5 (5), V5+ (5.5), V6 (6) -> median index 1 -> V5+
    expect(updateCall![1]![0]).toBe('V5+');
  });

  it('should do nothing when no grades exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await calculateConsensusGrade('prob-5');

    // Should not attempt an UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('should handle single grade', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_grade: 'V7' }],
      rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await calculateConsensusGrade('prob-6');

    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall![1]![0]).toBe('V7');
  });
});

describe('incrementTotalSends', () => {
  it('should call UPDATE with correct problem id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await incrementTotalSends('prob-1');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const call = mockQuery.mock.calls[0];
    expect(call![0]).toContain('total_sends = total_sends + 1');
    expect(call![1]).toEqual(['prob-1']);
  });
});
