import "server-only";

import { apiFetch } from "./client";
import type { Comment, CommentListResponse } from "./types";

export function listComments(meetingId: string): Promise<CommentListResponse> {
  return apiFetch<CommentListResponse>(`/meetings/${meetingId}/comments`, {
    cache: "no-store",
  });
}

export function createComment(
  meetingId: string,
  input: { body: string; anchorTSec?: number; anchorSegmentId?: string; parentId?: string; mentions?: string[] },
): Promise<Comment> {
  return apiFetch<Comment>(`/meetings/${meetingId}/comments`, {
    method: "POST",
    body: input,
  });
}

export function updateComment(
  meetingId: string,
  commentId: string,
  input: { body?: string; resolved?: boolean; mentions?: string[] },
): Promise<Comment> {
  return apiFetch<Comment>(`/meetings/${meetingId}/comments/${commentId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteComment(
  meetingId: string,
  commentId: string,
): Promise<void> {
  return apiFetch<void>(`/meetings/${meetingId}/comments/${commentId}`, {
    method: "DELETE",
  });
}
