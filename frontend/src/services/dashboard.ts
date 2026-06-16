// services/api.ts
import { Recommendation, DashboardData, Issue } from '../types/dashboard';
import { API_ENDPOINTS } from '../constants/dashboard';
import { UserType } from 'types/userTypes';
import { aiAgentInstance } from 'api/common/axiosInstance';

class ApiService {
  private static instance: ApiService;

  private constructor() { }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  async fetchDashboardData(): Promise<DashboardData> {
    try {
      const response = await aiAgentInstance.post(API_ENDPOINTS.DASHBOARD,{});
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to fetch dashboard data');
    }
  }

  async fetchCommonIssues(organizationId: string): Promise<any[]> {
    try {
      const response = await aiAgentInstance.get(API_ENDPOINTS.COMMON_ISSUES, { params: { organization_id: organizationId } });
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to fetch common issues');
    }
  }

  async handleRecommendationAction(recommendation: Recommendation, templateId?: number, signal?: AbortSignal) {
    try {
      if (!recommendation.related_to_kb_ids) {
        console.warn('recommendation.related_to_kb_ids is undefined:', recommendation);
      }
      const payload = {
        action: recommendation.type,
        data: {
          kb_ids: (recommendation.related_to_kb_ids ?? []).map((item) => item.id),
          metadata: recommendation.metadata,
        },
        ...(templateId && { template_id: templateId }),
      };

      const response = await aiAgentInstance.post(API_ENDPOINTS.ACTION, payload, {
        signal,
      });

      return { ...recommendation, ...response.data.data, id: recommendation.id };

    } catch (error: any) {
      // Don't throw error if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        throw error;
      }
      if (error.response) {
        console.error('API error response:', error.response.data);
      } else {
        console.error('API error:', error);
      }
      throw new Error('Failed to handle recommendation action');
    }
  }

  async handleCommonIssueAction(issue: Issue) {
    try {
      const payload = {
        action: issue.type,
        data: {
          kb_ids: [],
          metadata: {
            title: issue.name,
            source: 'common_issues',
            ticketdata: issue.ticketdata,
          },
        },
      };

      const response = await aiAgentInstance.post(API_ENDPOINTS.ACTION, payload);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to handle common issue action');
    }
  }

  async submitForApproval(content: string) {
    // Implement the actual API call when ready
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 1000);
    });
  }

  async convertTemplate(content: string, targetTemplateId: number) {
    try {
      const payload = {
        content,
        target_template_id: targetTemplateId,
      };

      const response = await aiAgentInstance.post('/api/v1/knowledgeassist/convert_template', payload);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error('Convert template API error response:', error.response.data);
      } else {
        console.error('Convert template API error:', error);
      }
      throw new Error('Failed to convert template');
    }
  }

  // async createKB(payload: any, recommendation: Recommendation) {
  //   try {
  //     const payload = {
  //       action: recommendation.type,
  //       data: {
  //         kb_ids: recommendation.type === 'create_new_kb'
  //           ? []
  //           : recommendation.related_to_kb_ids.map((item) => item.id),
  //         metadata: recommendation.type === 'create_new_kb'
  //           ? recommendation.metadata
  //           : null,
  //       },
  //     };
  //     const response = await axios.post(
  //       `${API_BASE_URL}${API_ENDPOINTS.ACTION}`,
  //       payload,
  //     );

  //     return response.data.data;
  //   } catch (error) {
  //     this.handleError(error);
  //   }
  // }

  async createKB(payload: any, user: UserType) {
    try {
      const response = await aiAgentInstance.post(`/api/v1/knowledgeassist/merge_and_save`, payload);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to create KB');
    }
  }

  async mergeAndSave(payload: any, user: UserType) {
    try {
      const response = await aiAgentInstance.post(`/api/v1/knowledgeassist/merge_and_save`, payload);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to merge and save');
    }
  }

  async translateAndSaveNew(payload: any, user: UserType) {
    try {
      const response = await aiAgentInstance.post(`/api/v1/knowledgeassist/translate_and_save`, payload);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to translate and save');
    }
  }

  async refactorAndSave(payload: any, user: UserType) {
    try {
      const response = await aiAgentInstance.post(`/api/v1/knowledgeassist/merge_and_save`, payload);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to refactor and save');
    }
  }

  async createKBFromCommonIssue(issue: {
    name: string;
    incidents: string[];
    category: string;
  }, user: UserType) {
    try {
      const payload = {
        action: 'create_new_kb',
        data: {
          kb_ids: [],
          metadata: {
            title: issue.name,
            incidents: issue.incidents,
            category: issue.category,
            source: 'common_issues',
          },
        },
      };

      const response = await aiAgentInstance.post(API_ENDPOINTS.ACTION, payload);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to create KB from common issue');
    }
  }

  async linkKBToCommonIssue(
    issue: { name: string; incidents: string[]; category: string },
    kbId: string,
    user: UserType,
  ) {
    try {
      const payload = {
        action: 'link_kb',
        data: {
          kb_ids: [kbId],
          metadata: {
            issue_name: issue.name,
            incidents: issue.incidents,
            category: issue.category,
          },
        },
      };

      const response = await aiAgentInstance.post(API_ENDPOINTS.ACTION, payload);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to link KB to common issue');
    }
  }


  async translateAndSave(payload: { content: string; target_language: string }, user: UserType) {
    try {
      console.log('Translation payload:', payload);

      // Match the exact body format from Postman
      const body = {
        content: payload.content,
        target_language: payload.target_language,
      };

      console.log('Request body:', body);

      const response = await aiAgentInstance.post(`/api/v1/knowledgeassist/translate_from_public_url`, body);
      return response.data;
    } catch (error) {
      throw new Error('Failed to translate from public URL');
    }
  }
}

export const apiService = ApiService.getInstance();
