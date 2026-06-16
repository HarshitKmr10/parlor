import React, { useState, useEffect } from 'react';
import { Box, Flex, Text, IconButton, DropdownMenu } from '@radix-ui/themes';
import { DotsVerticalIcon, Cross2Icon, ClockIcon } from '@radix-ui/react-icons';
import { PostcallTopics } from 'api/postcallTopcs';
import { KBEntryVersion, PostcallTopic } from 'types/postcallTopicTypes';
import { useGlobalContext } from 'contexts/store';
import { toast } from 'react-toastify';


interface PostcallVersionHistoryProps {
    isOpen?: boolean;
    onClose?: () => void;
    postcallTopicId?: string | null;
    onVersionRestore?: (restoredTopic: PostcallTopic) => void;
}

function PostcallVersionHistory({ isOpen = true, onClose, postcallTopicId, onVersionRestore }: PostcallVersionHistoryProps) {
    const [history, setHistory] = useState<KBEntryVersion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useGlobalContext();
    const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
    const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);


    useEffect(() => {
        const fetchHistory = async () => {
            if (!postcallTopicId || !isOpen || !user) return;

            setIsLoading(true);
            try {
                const versions = await PostcallTopics.getKBEntryVersions(postcallTopicId, user);
                setHistory(versions);
            } catch (error) {
                console.error('Error fetching version history:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [postcallTopicId, isOpen, user]);

    const handleRestore = async (versionId: string) => {
        if (!user || !postcallTopicId) return;

        setRestoringVersionId(versionId);
        try {
            const restoredTopic = await PostcallTopics.restoreKBEntryVersion(versionId, user);
            onVersionRestore?.(restoredTopic);
            toast.success('Version restored successfully');
            onClose?.();
        } catch (error) {
            console.error('Error restoring version:', error);
            toast.error('Failed to restore version');
        } finally {
            setRestoringVersionId(null);
            setOpenMenuIndex(null);
        }
    };

    const handlePreview = async (kbEntry: string) => {
        if (!user) return;
        
        try {
            const pdfBlob = await PostcallTopics.convertMarkdownToPdf(kbEntry, user);
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');
            
            // Clean up the URL object after the window is opened
            setTimeout(() => {
                URL.revokeObjectURL(pdfUrl);
            }, 100);
        } catch (error) {
            console.error('Error generating PDF preview:', error);
            toast.error('Failed to generate PDF preview');
        }
    };

    return (
        <>
            {isOpen && (
                <Box
                    className="fixed inset-0 bg-[rgba(0,0,0,0.4)] z-[9999]"
                    onClick={onClose}
                />
            )}
            <Box
                className={`fixed right-0 top-0 h-screen w-[300px] border-l border-[var(--gray-6)] bg-[var(--gray-2)] shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col z-[10000] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <Flex justify="between" align="center" className="p-4 border-b border-[var(--gray-6)] flex-shrink-0">
                    <Text size="3" weight="bold">Version History</Text>
                    <IconButton size="2" variant="ghost" onClick={onClose}>
                        <Cross2Icon />
                    </IconButton>
                </Flex>
                <Box className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <Text size="2" className="p-4">Loading version history...</Text>
                    ) : history.map((entry, index) => (
                        <Flex
                            key={index}
                            p="4"
                            gap="3"
                            align="start"
                            justify="between"
                            className="border-b border-[var(--gray-6)] hover:bg-[var(--gray-3)]"
                        >
                            <Flex gap="3">
                                <ClockIcon className="text-[var(--gray-8)] mt-1" />
                                <Flex direction="column" gap="1">
                                    <Text size="2" color="gray">
                                        {new Date(entry.created_at).toLocaleString()}
                                    </Text>
                                    {index === 0 ? (
                                        <Text size="2" weight="bold">Current Version</Text>
                                    ) : index === history.length - 1 && (
                                        <Text size="2">First Version</Text>
                                    )}
                                    <Text size="2" color="gray">{entry.user?.name || entry.user?.email}</Text>
                                </Flex>
                            </Flex>
                            {index !== 0 && (
                                <DropdownMenu.Root open={restoringVersionId === entry.id || openMenuIndex === index} onOpenChange={(open) => {
                                    if (!restoringVersionId) {
                                        setOpenMenuIndex(open ? index : null);
                                    }
                                }}>
                                    <DropdownMenu.Trigger>
                                        <IconButton size="1" variant="ghost">
                                            <DotsVerticalIcon />
                                        </IconButton>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content>
                                        <DropdownMenu.Item
                                            onClick={() => handleRestore(entry.id)}
                                            disabled={restoringVersionId === entry.id}
                                        >
                                            {restoringVersionId === entry.id ? 'Restoring...' : 'Restore this version'}
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onClick={() => handlePreview(entry.kb_entry)}
                                        >
                                            Show preview
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            )}
                        </Flex>
                    ))}
                </Box>
            </Box>
        </>
    );
}

export default PostcallVersionHistory; 