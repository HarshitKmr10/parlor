import { serviceDeskInstance } from 'api/common/axiosInstance';
import { UserType } from 'types/common';
import axios from 'axios';
import { CONFIG } from 'config';
import { PostcallTopic, PostcallTopicsResponse, KBEntryVersion, PostcallTopicListViewResponse, PostcallTopicListView } from 'types/postcallTopicTypes';

export const PostcallTopics = {
    async getPostcallTopicsForMeeting(
        meetingID: string,
        user: UserType,
    ): Promise<PostcallTopic[]> {
        try {
            const response = await serviceDeskInstance.get<PostcallTopicsResponse>(
                `meetings/${meetingID}/postcall_topics`
            );

            const { data } = response.data;
            return data;
        } catch (err) {
            console.error('There was an error fetching meetings');
        }
    },

    async updateKnowledgeBaseEntry(
        postcallTopicId: string,
        kbEntry: string,
        user: UserType,
    ): Promise<PostcallTopic> {
        try {
            const response = await serviceDeskInstance.put(
                `postcall_topics/${postcallTopicId}/update_kb`,
                { kb_entry: kbEntry }
            );

            return response.data;
        } catch (err) {
            console.error('Error updating knowledge base entry:', err);
            throw err;
        }
    },

    async getKBEntryVersions(
        postcallTopicId: string,
        user: UserType,
    ): Promise<KBEntryVersion[]> {
        try {
            const response = await serviceDeskInstance.get<KBEntryVersion[]>(
                `service_desk/${postcallTopicId}/get_kb_entry_versions`
            );

            return response.data;
        } catch (err) {
            console.error('Error fetching KB entry versions:', err);
            throw err;
        }
    },

    async restoreKBEntryVersion(
        kbEntryVersionId: string,
        user: UserType,
    ): Promise<PostcallTopic> {
        try {
            const response = await serviceDeskInstance.post<PostcallTopic>(
                `postcall_topics/${kbEntryVersionId}/restore_kb_entry`,
                {},  // empty body since we don't need to send any data
            );

            return response.data;
        } catch (err) {
            console.error('Error restoring KB entry version:', err);
            throw err;
        }
    },

    async convertMarkdownToPdf(
        markdownContent: string,
        user: UserType,
    ): Promise<Blob> {
        try {
            const response = await serviceDeskInstance.post(
                'service_desk/convert_markdown_to_pdf',
                { markdown_content: markdownContent },
                {
                    responseType: 'blob', // Important: tells axios to expect binary data
                },
            );

            return response.data;
        } catch (err) {
            console.error('Error converting markdown to PDF:', err);
            throw err;
        }
    },

    async getAllKTPostcallTopics(
        teamId: string,
        user: UserType,
    ): Promise<PostcallTopicListView[]> {
        try {
            const response = await serviceDeskInstance.get<PostcallTopicListViewResponse>(
                `service_desk/${teamId}/get_all_kt_postcall_topics`
            );

            const { data } = response.data;
            return data;
        } catch (err) {
            console.error('Error fetching KT postcall topics:', err);
            throw err;
        }
    },

    async getPostcallTopicKeywords(
        meetingId: string,
        user: UserType,
    ): Promise<{ keywords: string[], speakers: string[] }> {
        try {
            const response = await serviceDeskInstance.get(
                `meetings/${meetingId}/keywords`
            );

            const { data } = response.data;
            return data;
        } catch (err) {
            console.error('Error fetching postcall topic keywords:', err);
            throw err;
        }
    },

    async getPostcallTopicKbEntryPdf(
        topicId: string,
        user: UserType,
    ): Promise<Blob> {
        try {
            const response = await serviceDeskInstance.get(
                `service_desk/postcall_topic/${topicId}/kb_entry_pdf`,
                {
                    responseType: 'blob',
                }
            );

            return response.data;
        } catch (err) {
            console.error('Error converting markdown to PDF:', err);
            throw err;
        }
    },

    async deletePostcallTopic(
        postcallTopicId: string,
        user: UserType,
    ): Promise<void> {
        try {
            await serviceDeskInstance.delete(
                `postcall_topics/${postcallTopicId}`
            );
        } catch (err) {
            console.error('Error deleting postcall topic:', err);
            throw err;
        }
    },

    async deletePostcallTopics(
        postcallTopicIds: string[],
        user: UserType,
    ): Promise<void> {
        try {
            await serviceDeskInstance.delete(
                `service_desk/delete_postcall_topics`,
                {
                    data: { postcall_topic_ids: postcallTopicIds },
                },
            );
        } catch (err) {
            console.error('Error deleting postcall topics:', err);
            throw err;
        }
    },

    async addPostcallTopicsToKbCollection(
        postcallTopicIds: string[],
        kbCollectionId: string,
        user: UserType,
    ): Promise<void> {
        try {
            await serviceDeskInstance.post(
                `service_desk/add_postcall_topics_to_kb_collection`,
                {
                    postcall_topic_ids: postcallTopicIds,
                    kb_collection_id: kbCollectionId,
                }
            );
        } catch (err) {
            console.error('Error adding postcall topics to KB collection:', err);
            throw err;
        }
    },

    async approvePostcallTopics(
        postcallTopicIds: string[],
        user: UserType,
    ): Promise<void> {
        try {
            await serviceDeskInstance.post(
                `service_desk/approve_postcall_topics`, { postcall_topic_ids: postcallTopicIds, }
            );
        } catch (err) {
            console.error('Error approving postcall topics:', err);
            throw err;
        }
    },

    async convertDocumentToPdf(
        documentId: string,
        user: UserType,
    ): Promise<Blob> {
        try {
            const response = await serviceDeskInstance.post(
                'service_desk/document_to_pdf',
                { document_id: documentId },
                {
                    responseType: 'blob', // Important: tells axios to expect binary data
                }
            );

            return response.data;
        } catch (err) {
            console.error('Error converting document to PDF:', err);
            throw err;
        }
    },

    async convertMarkdownToPdfDocxZip(
        markdownContent: string,
        user: UserType,
        documentId?: string,
        fileName?: string,
    ): Promise<Blob> {
        try {
            const response = await serviceDeskInstance.post(
                'service_desk/convert_markdown_to_pdf_docx_zip',
                { 
                    markdown_content: markdownContent,
                    document_id: documentId,
                    file_name: fileName,
                },
                {
                    responseType: 'blob', // Important: tells axios to expect binary data
                }
            );

            return response.data;
        } catch (err) {
            console.error('Error converting markdown to PDF/DOCX zip:', err);
            throw err;
        }
    }
};