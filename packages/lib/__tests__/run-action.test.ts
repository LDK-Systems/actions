import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/core', () => ({
  setFailed: vi.fn(),
}));

import * as core from '@actions/core';
import { runAction } from '../src/run-action';

const mockSetFailed = vi.mocked(core.setFailed);

describe('runAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call setFailed when fn resolves successfully', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    runAction(fn);
    await Promise.resolve();
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it('calls setFailed with error.message when fn rejects with an Error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    runAction(fn);
    await Promise.resolve();
    expect(mockSetFailed).toHaveBeenCalledWith('boom');
  });

  it('calls setFailed with fallback message when fn rejects with a non-Error value', async () => {
    const fn = vi.fn().mockRejectedValue('string rejection');
    runAction(fn);
    await Promise.resolve();
    expect(mockSetFailed).toHaveBeenCalledWith('An unexpected error occurred');
  });
});
