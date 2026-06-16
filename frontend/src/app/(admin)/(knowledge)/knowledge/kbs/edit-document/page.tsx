'use client';

import React, { useState, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import withAuth from 'components/withAuth';
import { Box, Flex, Button, Text, Dialog, TextField, Select, Spinner } from '@radix-ui/themes';
import { ArrowLeft, Save, Download } from 'lucide-react';
import RichTextEditor from 'components/TipTap/TipTap';
import { useGlobalContext } from 'contexts/store';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import { PostcallTopics } from 'api/postcallTopcs';
import { PostcallTopic } from 'types/postcallTopicTypes';
import LoadingSpinner from 'components/spinner/spinner';
import { ToastContainer } from 'react-toastify';
import PostcallVersionHistory from 'components/postcall/PostcallVersionHistory';
import 'react-toastify/dist/ReactToastify.css';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { API_ENDPOINTS } from 'constants/dashboard';

interface CreateKBTabViewProps {
  meetingId?: string;
  postcallTopics: PostcallTopic[];
  isLoadingPostcallTopics: boolean;
  onUpdatePostcallTopics: (updatedTopics: PostcallTopic[]) => void;
}

function EditDocumentPage() {
    const { user } = useGlobalContext();
    const searchParams = useSearchParams();
    const router = useRouter();
    const documentId = searchParams.get('id');
    const meetingId = searchParams.get('meetingId');

    // State for managing the selected KB and content
    const [selectedPostCallTopicId, setSelectedPostCallTopicId] = useState<string | null>(null);
    const [kbContent, setKbContent] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [editorKey, updateEditorKey] = useReducer(x => x + 1, 0);
    const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState<boolean>(false);

    // Mock data - in real implementation, this would come from props or context
    const [postcallTopics, setPostcallTopics] = useState<PostcallTopic[]>([]);
    const [isLoadingPostcallTopics, setIsLoadingPostcallTopics] = useState(false);

    interface Collection {
        id: string;
        name: string;
        source: string;
        source_config: Record<string, any>;
    }

    // Collections state for collection-required dialog
    const [collections, setCollections] = useState<Collection[]>([]);
    const [isLoadingCollections, setIsLoadingCollections] = useState(true);
    const [showCollectionRequiredDialog, setShowCollectionRequiredDialog] = useState(false);
    const [selectedCollectionForAdd, setSelectedCollectionForAdd] = useState('');
    const [isAddingToCollection, setIsAddingToCollection] = useState(false);

    // Fetch postcall topics for the meeting
    useEffect(() => {
        const fetchPostcallTopics = async () => {
            if (!meetingId) return;
            
            setIsLoadingPostcallTopics(true);
            try {
                const topics = await PostcallTopics.getPostcallTopicsForMeeting(meetingId, user);
                setPostcallTopics(topics);
                
                // If we have a documentId, find and select that specific topic
                if (documentId && topics.length > 0) {
                    const targetTopic = topics.find(topic => topic.id === documentId);
                    if (targetTopic) {
                        setSelectedPostCallTopicId(targetTopic.id);
                        setKbContent(targetTopic.kb_entry);
                    }
                }
            } catch (error) {
                console.error('Error fetching postcall topics:', error);
                toast.error('Failed to fetch knowledge base articles');
            } finally {
                setIsLoadingPostcallTopics(false);
            }
        };

        fetchPostcallTopics();
    }, [meetingId, documentId, user]);

    // Fetch collections on mount (for dialog) - uses Knowledge Assist RBAC endpoint
    useEffect(() => {
        const fetchCollections = async () => {
            try {
                setIsLoadingCollections(true);
                const response = await serviceDeskInstance.get(API_ENDPOINTS.KNOWLEDGE_ASSIST_COLLECTIONS);

                if (response.status !== 200) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = response.data;
                if (data.success && data.data) {
                    setCollections(data.data);
                }
            } catch (error) {
                console.error('Error fetching collections:', error);
                toast.error('Failed to load collections');
            } finally {
                setIsLoadingCollections(false);
            }
        };

        if (user?.access_token) {
            fetchCollections();
        }
    }, [user?.access_token]);

    // Handle KB selection
    const handleKbSelect = useCallback((kbId: string) => {
        const selectedKb = postcallTopics.find((kb) => kb.id === kbId);
        if (selectedKb) {
            setKbContent(selectedKb.kb_entry);
            setSelectedPostCallTopicId(kbId);
        }
    }, [postcallTopics]);

    // Handle content change
    const handleContentChange = useCallback((newContent: string) => {
        setKbContent(newContent);
    }, []);

    // Handle save
    const handleSave = async () => {
        if (!selectedPostCallTopicId || !kbContent) return;

        // Require collection before saving
        const selectedTopic = postcallTopics.find(topic => topic.id === selectedPostCallTopicId);
        if (!selectedTopic?.knowledgebase_collection_id) {
            setShowCollectionRequiredDialog(true);
            return;
        }

        setIsSaving(true);
        try {
            await PostcallTopics.updateKnowledgeBaseEntry(selectedPostCallTopicId, kbContent, user);

            // Update local state
            const updatedTopics = postcallTopics.map((topic) =>
                topic.id === selectedPostCallTopicId ? { ...topic, kb_entry: kbContent } : topic
            );
            setPostcallTopics(updatedTopics);

            toast.success('Knowledge base article saved successfully');
        } catch (error) {
            console.error('Error saving KB:', error);
            toast.error('Failed to save knowledge base article');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle add to collection and save
    const handleAddToCollectionAndSave = async () => {
        if (!selectedCollectionForAdd || !selectedPostCallTopicId || !user || !kbContent) return;

        setIsAddingToCollection(true);
        setIsSaving(true);
        try {
            // Add to collection
            await PostcallTopics.addPostcallTopicsToKbCollection(
                [selectedPostCallTopicId],
                selectedCollectionForAdd,
                user
            );

            // Save content
            await PostcallTopics.updateKnowledgeBaseEntry(selectedPostCallTopicId, kbContent, user);

            // Update state
            const updatedTopics = postcallTopics.map(topic => {
                if (topic.id === selectedPostCallTopicId) {
                    return {
                        ...topic,
                        kb_entry: kbContent,
                        knowledgebase_collection_id: selectedCollectionForAdd
                    };
                }
                return topic;
            });
            setPostcallTopics(updatedTopics);

            toast.success('Added to collection and saved');
            setShowCollectionRequiredDialog(false);
            setSelectedCollectionForAdd('');
        } catch (error) {
            console.error('Error adding to collection and saving:', error);
            toast.error('Failed to add to collection and save');
        } finally {
            setIsAddingToCollection(false);
            setIsSaving(false);
        }
    };

    // Handle download
    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            // Get the selected topic for document id and name
            const selectedTopic = postcallTopics.find(topic => topic.id === selectedPostCallTopicId);
            
            // Remove highlights from content before converting to PDF
            const cleanContent = kbContent.replace(/<mark[^>]*>(.*?)<\/mark>/g, '$1');

            // Convert the clean content to a PDF using the API
            const pdfBlob = await PostcallTopics.convertMarkdownToPdfDocxZip(
                cleanContent, 
                user,
                selectedTopic?.id,
                selectedTopic?.topic
            );

            // Create a URL for the blob
            const url = window.URL.createObjectURL(pdfBlob);

            // Create a temporary link element
            const link = document.createElement('a');
            link.href = url;
            // Use topic name if available, otherwise use timestamp
            const fileName = selectedTopic?.topic 
                && `${selectedTopic.topic}.zip`;
               
            link.download = fileName;

            // Trigger the download
            document.body.appendChild(link);
            link.click();

            // Clean up
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setIsDownloading(false);
        }
    };

    // Handle version restore
    const handleVersionRestore = useCallback(
        (restoredTopic: PostcallTopic) => {
            setKbContent(restoredTopic.kb_entry);
            updateEditorKey();
            const updatedTopics = postcallTopics.map((topic) =>
                topic.id === selectedPostCallTopicId ? restoredTopic : topic
            );
            setPostcallTopics(updatedTopics);
        },
        [selectedPostCallTopicId, postcallTopics]
    );

    if (isLoadingPostcallTopics) {
        return (
            <Flex justify="center" align="center" className="h-full">
                <LoadingSpinner />
            </Flex>
        );
    }

    if (!postcallTopics || postcallTopics.length === 0) {
        return (
            <Flex justify="center" align="center" className="h-full">
                <Text>No knowledge base articles found for this meeting</Text>
            </Flex>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <Flex
                justify="between"
                align="center"
                className="h-14 border-b border-[var(--gray-8)] px-4 flex-shrink-0 bg-white"
            >
                <Flex align="center" gap="3" className="pl-2">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="p-0 cursor-pointer"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-[18px] font-medium">
                        {selectedPostCallTopicId ? 
                            postcallTopics.find(t => t.id === selectedPostCallTopicId)?.topic || 'Untitled Document' :
                            'Select a Knowledge Base Article'
                        }
                    </span>
                </Flex>
                
                {/* Action Buttons */}
                <Flex gap="3">
                    <Button 
                        variant="soft" 
                        onClick={() => setIsVersionHistoryOpen(true)} 
                        disabled={!selectedPostCallTopicId}
                    >
                        Version History
                    </Button>
                    <Button variant="soft" onClick={handleDownload} disabled={!selectedPostCallTopicId || isDownloading}>
                        {isDownloading && <Spinner size="1" style={{ marginRight: 8 }} />}
                        <Download className="h-4 w-4 mr-2" />
                        Download File
                    </Button>
                    <Button 
                        variant="solid" 
                        onClick={handleSave} 
                        disabled={isSaving || !selectedPostCallTopicId}
                    >
                        {isSaving ? 'Saving...' : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </Flex>
            </Flex>

            {/* KB Selection and Editor */}
            <Flex gap="4" className="flex-1 min-h-0">
                {/* Left Panel - KB Selection */}
                <Box className="w-1/3 border-r overflow-scroll">
                    <Box className='h-10  border-b border-[var(--gray-4)] p-2'>
                    <Text size="4" weight="bold">
                        Knowledge Base Articles
                    </Text>
                    </Box>
                    <Box className="w-full h-[calc(100vh-120px)] overflow-y-scroll">
                        {postcallTopics.map((kb) => (
                            <Flex
                                key={kb.id}
                                justify="between"
                                align="center"
                                className={`px-4 py-3 border-b border-[var(--gray-4)] w-full cursor-pointer group ${
                                    selectedPostCallTopicId === kb.id
                                        ? 'bg-[var(--accent-3)]'
                                        : 'hover:bg-[var(--gray-2)]'
                                }`}
                                onClick={() => handleKbSelect(kb.id)}
                            >
                                <Text size="2" className="flex-1">
                                    {kb.topic}
                                </Text>
                            </Flex>
                        ))}
                    </Box>
                </Box>

                {/* Right Panel - Editor */}
                <Box className="w-2/3 overflow-hidden">
                    {selectedPostCallTopicId ? (
                        <Box className="h-[calc(100vh-5rem)] border rounded-lg overflow-hidden">
                            <div className="h-full overflow-y-auto">
                                <RichTextEditor
                                    key={`${selectedPostCallTopicId}-${editorKey}`}
                                    content={kbContent}
                                    onChange={handleContentChange}
                                    disabled={false}
                                />
                            </div>
                        </Box>
                    ) : (
                        <Flex align="center" justify="center" className="h-full text-[var(--gray-8)]">
                            <Text size="3">Select a knowledge base article from the left to view and edit</Text>
                        </Flex>
                    )}
                </Box>
            </Flex>

            <ToastContainer />

            {/* Version History Modal */}
            <PostcallVersionHistory
                isOpen={isVersionHistoryOpen}
                onClose={() => setIsVersionHistoryOpen(false)}
                postcallTopicId={selectedPostCallTopicId}
                onVersionRestore={handleVersionRestore}
            />

            {/* Collection Required Dialog (for Save button) */}
            <Dialog.Root open={showCollectionRequiredDialog} onOpenChange={setShowCollectionRequiredDialog}>
                <Dialog.Content style={{ maxWidth: 400 }}>
                    <Dialog.Title>Add to Collection Required</Dialog.Title>
                    <Dialog.Description size="2" mb="4">
                        Please select a collection before saving.
                    </Dialog.Description>

                    <Flex direction="column" gap="3" className="my-4">
                        {isLoadingCollections ? (
                            <Flex align="center" justify="center" py="4">
                                <Spinner size="2" />
                            </Flex>
                        ) : (
                            <>
                                <Select.Root
                                    value={selectedCollectionForAdd}
                                    onValueChange={setSelectedCollectionForAdd}
                                >
                                    <Select.Trigger
                                        className="w-full"
                                        placeholder="Choose a collection"
                                    />
                                    <Select.Content>
                                        <Select.Group>
                                            {collections.map((collection) => (
                                                <Select.Item key={collection.id} value={collection.id}>
                                                    {collection.name}
                                                </Select.Item>
                                            ))}
                                        </Select.Group>
                                    </Select.Content>
                                </Select.Root>
                                <Text size="2" color="gray">
                                    Documents are auto-approved when added to a collection.
                                </Text>
                            </>
                        )}
                    </Flex>

                    <Flex gap="3" justify="end">
                        <Button
                            variant="soft"
                            color="gray"
                            onClick={() => setShowCollectionRequiredDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddToCollectionAndSave}
                            disabled={
                                isAddingToCollection ||
                                isSaving ||
                                !selectedCollectionForAdd
                            }
                        >
                            <Flex align="center" gap="2">
                                {(isAddingToCollection || isSaving) && <Spinner size="1" />}
                                Add to Collection and Save
                            </Flex>
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withAuth(EditDocumentPage);
