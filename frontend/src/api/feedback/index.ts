import { serviceDeskInstance } from 'api/common/axiosInstance';

export interface FeedbackUploadResponse {
  success: boolean;
  message?: string;
  screenshot_urls?: string[];
}

export interface FeedbackSubmitRequest {
  category: string;
  content: string;
  page_url: string;
  screenshot_urls?: string[];
  workspace_id?: string;
  work_item_id?: string | null;
  chat_session_id?: string | null;
}

export interface FeedbackSubmitResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export const Feedback = {
  /**
   * Upload screenshot files to get URLs
   * @param files - Array of File objects to upload
   * @returns Promise with screenshot URLs
   */
  async uploadScreenshots(files: File[]): Promise<string[]> {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await serviceDeskInstance.post<FeedbackUploadResponse>(
        '/feedback/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success && response.data.screenshot_urls) {
        return response.data.screenshot_urls;
      }

      throw new Error(response.data.message || 'Failed to upload screenshots');
    } catch (error: any) {
      console.error('Error uploading screenshots:', error);
      throw new Error(
        error.response?.data?.message || error.message || 'Failed to upload screenshots'
      );
    }
  },

  /**
   * Submit feedback with category, content, page URL, and optional screenshot URLs
   * @param feedbackData - Feedback submission data
   * @returns Promise with submission response
   */
  async submitFeedback(feedbackData: FeedbackSubmitRequest): Promise<FeedbackSubmitResponse> {
    try {
      const formData = new FormData();
      formData.append('category', feedbackData.category);
      formData.append('content', feedbackData.content);
      formData.append('page_url', feedbackData.page_url);

      if (feedbackData.screenshot_urls && feedbackData.screenshot_urls.length > 0) {
        feedbackData.screenshot_urls.forEach((url) => {
          formData.append('screenshot_urls', url);
        });
      }

      if (feedbackData.workspace_id) {
        formData.append('workspace_id', feedbackData.workspace_id);
      }

      if (feedbackData.work_item_id) {
        formData.append('work_item_id', feedbackData.work_item_id);
      }

      if (feedbackData.chat_session_id) {
        formData.append('chat_session_id', feedbackData.chat_session_id);
      }

      const response = await serviceDeskInstance.post<FeedbackSubmitResponse>(
        '/feedback',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      throw new Error(
        error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to submit feedback'
      );
    }
  },
};
