import React, { useEffect, useState } from 'react';
import {
    Box, Flex, Text, Badge,
} from '@radix-ui/themes';
import AIChatIcon from 'components/icons/AIChatIcon';
import { PostcallTopics } from 'api/postcallTopcs';
import { UserType } from 'types/common';
import { useGlobalContext } from 'contexts/store';

interface PostCallKeywordsProps {
    meetingId: string;
    agentName?: string;
}

function NoKeywords() {
    return (
        <Flex>
            <Text size="2" color="gray" weight="medium">
                No keywords detected
            </Text>
        </Flex>
    );
}

function PostCallKeywords({ meetingId, agentName }: PostCallKeywordsProps) {
    const [loading, setLoading] = useState<boolean>(true);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [speakers, setSpeakers] = useState<string[]>([]);
    const [error, setError] = useState<boolean>(false);

    const { user } = useGlobalContext();

    useEffect(() => {
        const fetchKeywords = async () => {
            setLoading(true);
            try {
                const response = await PostcallTopics.getPostcallTopicKeywords(meetingId, user);
                setKeywords(response.keywords);
                setSpeakers(response.speakers);
                setError(false);
            } catch (err) {
                console.error('Error fetching keywords:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (meetingId && user) {
            fetchKeywords();
        }
    }, [meetingId, user]);

    const renderContent = () => {
        if (loading) {
            return (
                <Box>
                    {[...Array(2)].map((_, index) => (
                        <Box key={index} mb="2">
                            <div
                                className="loading-skeleton"
                                style={{
                                    width: '100px',
                                    height: '16px',
                                    backgroundColor: 'var(--accent-4)',
                                    borderRadius: 'var(--radius-2)',
                                    marginBottom: '8px',
                                }}
                            />
                            <Flex wrap="wrap" gap="2" mt="1">
                                {[...Array(3)].map((_, badgeIndex) => (
                                    <div
                                        key={badgeIndex}
                                        className="loading-skeleton"
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            backgroundColor: 'var(--accent-4)',
                                            borderRadius: 'var(--radius-2)',
                                        }}
                                    />
                                ))}
                            </Flex>
                        </Box>
                    ))}
                </Box>
            );
        }

        if (error || (!keywords?.length && !speakers?.length)) {
            return <NoKeywords />;
        }

        return (
            <>
                {keywords.length > 0 && (
                    <Box mb="2">
                        <Text size="2" weight="bold" mb="2">
                            Keywords
                        </Text>
                        <Flex wrap="wrap" gap="2" mt="1">
                            {keywords.map((keyword) => (
                                <Badge key={keyword} size="3" variant="surface">
                                    {keyword}
                                </Badge>
                            ))}
                        </Flex>
                    </Box>
                )}
                {speakers.length > 0 && (
                    <Box mb="2">
                        <Text size="2" weight="bold" mb="2">
                            Speakers
                        </Text>
                        <Flex wrap="wrap" gap="2" mt="1">
                            {speakers.map((speaker) => (
                                <Badge key={speaker} size="3" variant="surface">
                                    {speaker}
                                </Badge>
                            ))}
                        </Flex>
                    </Box>
                )}
            </>
        );
    };

    return (
        <Box className="border-b border-[var(--accent-3)] py-2">
            <Flex gap="2">
                <Box className="ml-3">
                    <AIChatIcon />
                </Box>
                <Flex direction="column">
                    <Flex gap="2">
                        <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
                            {agentName || "Knowledge Assist"}
                        </Text>
                        <Badge>AI Generated</Badge>
                    </Flex>
                    <Box style={{ overflowY: 'auto' }}>{renderContent()}</Box>
                </Flex>
            </Flex>
        </Box>
    );
}

export default PostCallKeywords; 