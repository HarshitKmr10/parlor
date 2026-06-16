'use client';

import { Cross1Icon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { ArrowLeftIcon } from 'lucide-react';
import {
    Badge,
    Button,
    Flex,
    Grid,
    Heading,
    Text,
    TextField,
    Table,
    Dialog,
    AlertDialog,
} from '@radix-ui/themes';
import AgentAssistIcon from 'components/icons/AgentAssistIcon';
import { BookIcon } from 'components/icons/BookIcon';
import { BorderAllOutlineIcon } from 'components/icons/BorderAllOutlineIcon';
import { ChatSparkleOutline } from 'components/icons/ChatSparkleOutline';
import { DataTrendingIcon } from 'components/icons/DataTrendingIcon';
import { ErrorOutlineIcon } from 'components/icons/ErrorOutlineIcon';
import { GraduateCapIcon } from 'components/icons/GraduateCapIcon';
import { IconBox } from 'components/icons/IconBox';
import { OutlineMessageIcon } from 'components/icons/OutlineMessageIcon';
import { TransitionIcon } from 'components/icons/TransitionIcon';
import { useGlobalContext } from 'contexts/store';
import { PhoneCallIcon } from 'lucide-react';
import React, { SVGProps, useMemo, useState } from 'react';
import { GoCopilot } from 'react-icons/go';
import { GrUserExpert } from 'react-icons/gr';
import { RiChatVoiceLine } from 'react-icons/ri';

interface ProductTag {
    name: string;
    color: string;
    icon: React.FC<SVGProps<SVGSVGElement>>;
}

interface DashBoardCard {
    title: string;
    description: string;
    icon: React.ReactNode;
    iconBgColor: string;
    tag: ProductTag;
    docs: DocumentLink[];
}

interface DocumentLink {
    title: string;
    description: string;
    url: string;
}

function HelpDocs() {
    const [tagFilter, setTagFilter] = useState('All Categories');
    const [selectedCard, setSelectedCard] = useState<DashBoardCard | null>(null);
    const [selectedDocUrl, setSelectedDocUrl] = useState<string | null>(null);
    const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { organization } = useGlobalContext();

    const filteredDashboardCards = useMemo(() => {
        return dashboardCards.filter((card) => {
            return tagFilter === 'All Categories' || card.tag.name === tagFilter;
        });
    }, [tagFilter]);

    const handleCardClick = (card: DashBoardCard) => {
        setSelectedCard(card);
    };

    const handleBack = () => {
        setSelectedCard(null);
    };

    const handleViewPdf = (url: string, title: string) => {
        const encodedUrl = encodeURI(url);
        setSelectedDocUrl(encodedUrl);
        setSelectedDocTitle(title);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedDocUrl(null);
    };

    if (selectedCard) {
        return (
            <Flex direction="column" className="h-full w-full overflow-y-auto bg-[#fcfcfd] p-6">
                <Flex align="center" gap="3">
                    <Button onClick={handleBack} variant="ghost" className="cursor-pointer">
                        <ArrowLeftIcon size={20} />
                    </Button>
                    <Heading size="6">{selectedCard.title} Documentation</Heading>
                </Flex>

                <Flex direction="column" className="rounded-xl bg-white p-6 shadow-sm">
                    <Table.Root>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>Document Title</Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>

                        <Table.Body>
                            {selectedCard.docs.map((doc, index) => (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <Text
                                            className="cursor-pointer hover:text-[#6666D7]"
                                            onClick={() => handleViewPdf(doc.url, doc.title)}
                                        >
                                            {doc.title}
                                        </Text>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table.Root>
                </Flex>
                <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <Dialog.Content style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                        <Dialog.Title>{selectedDocTitle}</Dialog.Title>
                        <Dialog.Description>
                            <iframe
                                src={selectedDocUrl}
                                width="100%"
                                height="700px"
                                id="pdfModal"
                                style={{ display: 'block', position: 'relative' }}
                            />
                        </Dialog.Description>

                        <Flex gap="3" mt="4" justify="end">
                            <Dialog.Close>
                                <Button variant="soft" onClick={handleCloseModal}>
                                    Close
                                </Button>
                            </Dialog.Close>
                        </Flex>
                    </Dialog.Content>
                </Dialog.Root>
            </Flex>
        );
    }

    return (
        <Flex direction="column" className="h-full w-full overflow-y-auto bg-[#fcfcfd] p-6">
            <Flex
                direction="column"
                gap="4"
                align="center"
                justify="center"
                className="rounded-xl bg-[#F4F2FE] px-6 py-10"
            >
                <Heading size="8" highContrast>
                    Documentation Center
                </Heading>
                <Text className="max-w-2xl" align="center" size="3" color="gray">
                    Access comprehensive documentation for all our AI-powered tools and services. Select a module to
                    view its documentation.
                </Text>

                <Flex gap="4">
                    {Object.values(ProductsTags).map((tag) => (
                        <TagBadge
                            key={tag.name}
                            tag={tag}
                            onClick={setTagFilter}
                            active={tagFilter === tag.name}
                        />
                    ))}
                </Flex>
            </Flex>

            <Grid columns={{ xs: '1', sm: '2', md: '3', lg: '4', xl: '5' }} className="mt-6" gap="4">
                {filteredDashboardCards.map((card) => (
                    <div key={card.title} onClick={() => handleCardClick(card)} className="flex justify-stretch">
                        <Flex
                            direction="column"
                            gap="2"
                            className="transition-border w-full cursor-pointer rounded-xl border bg-white px-4 py-6 transition hover:border-[#5b5bd6] hover:shadow-sm"
                        >
                            <Flex direction="row" gap="2" align="center">
                                <IconBox size="30px" bgColor={card.iconBgColor}>
                                    {card.icon}
                                </IconBox>
                                <Text size="4" weight="medium" highContrast>
                                    {card.title}
                                </Text>
                            </Flex>
                            <Flex className="flex-1">
                                <Text color="gray" size="2">
                                    {card.description}
                                </Text>
                            </Flex>
                            <TagBadge tag={card.tag} />
                        </Flex>
                    </div>
                ))}
            </Grid>
        </Flex>
    );
}

// Reuse the TagBadge component from the home page
const TagBadge = ({
    tag,
    onClick,
    active,
}: {
    tag: ProductTag;
    onClick?: (name: string) => void;
    active?: boolean;
}) => {
    const handleClick = () => {
        onClick?.(tag.name);
    };

    const { icon: Icon } = tag;

    return (
        <Badge
            radius="full"
            style={{ color: active ? '#fff' : tag.color, background: active ? '#6666D7' : 'white' }}
            className={`transition transition-border cursor-pointer place-self-end border border-indigo-200 px-3 py-1  ${onClick ? 'hover:border-indigo-600' : ''
                }`}
            onClick={handleClick}
        >
            <Icon color={active ? '#fff' : tag.color} />
            <Text size="2" weight="medium">
                {tag.name}
            </Text>
        </Badge>
    );
};

// Reuse the ProductsTags from the home page
const ProductsTags: Record<string, ProductTag> = {
    ALL: {
        name: 'All Categories',
        color: '#333',
        icon: BorderAllOutlineIcon,
    },
    TRANSITION_ASSIST: {
        name: 'Transition Assist',
        color: '#6666D7',
        icon: TransitionIcon,
    },
    REACTIVE_MODULES: {
        name: 'EX/CX Modules',
        color: '#00C7BE',
        icon: ChatSparkleOutline,
    },
    PROACTIVE_MODULES: {
        name: 'TechOps Modules',
        color: '#AF52DE',
        icon: DataTrendingIcon,
    },
};

const baseDocsUrl = 'https://knowledgebasedev.blob.core.windows.net/helpdocs';

const dashboardCards: DashBoardCard[] = [
    {
        title: 'KnowledgeAI',
        description: 'Documentation for knowledge management and optimization',
        icon: <BookIcon color="#5856D6" />,
        tag: ProductsTags.TRANSITION_ASSIST,
        iconBgColor: '#5856D640',
        docs: [
            {
                title: 'How to Configure KnowledgeAI to Join a Google Meet Session',
                description: 'Guide to set up KnowledgeAI for Google Meet',
                url: `${baseDocsUrl}/knowledgeai/How to Configure KnowledgeAI to Join a Google Meet Session_.docx.pdf`,
            },
            {
                title: 'Can I Use a Custom KB Template with Knowledge AI',
                description: 'Explore the use of custom templates',
                url: `${baseDocsUrl}/knowledgeai/Can I Use a Custom KB Template with Knowledge AI_.docx.pdf`,
            },
            {
                title: 'How to KnowledgeAI to Join a Microsoft Teams Meeting',
                description: 'Set up KnowledgeAI for Microsoft Teams',
                url: `${baseDocsUrl}/knowledgeai/How to  KnowledgeAI to Join a Microsoft Teams Meeting.docx.pdf`,
            },
            {
                title: 'How to Access Meeting Summaries and Transcripts Generated by Knowledge AI',
                description: 'Accessing your meeting data',
                url: `${baseDocsUrl}/knowledgeai/How to Access Meeting Summaries and Transcripts Generated by Knowledge AI_.docx.pdf`,
            },
            {
                title: 'How to Get Started with Knowledge AI',
                description: 'Quick start guide',
                url: `${baseDocsUrl}/knowledgeai/How to Get Started with Knowledge AI_.docx.pdf`,
            },
            {
                title: 'How Can I Access, Download, and Customize KB Articles Created by KnowledgeAI',
                description: 'Managing your KB articles',
                url: `${baseDocsUrl}/knowledgeai/How Can I Access, Download, and Customize KB Articles Created by KnowledgeAI_.docx.pdf`,
            },
            {
                title: 'Can Knowledge AI Generate Multiple KB Articles from a Single Meeting Transcript',
                description: 'Learn about generating multiple articles',
                url: `${baseDocsUrl}/knowledgeai/Can Knowledge AI Generate Multiple KB Articles from a Single Meeting Transcript_.docx.pdf`,
            },
            {
                title: 'How to Use the AI Assist Feature to Query Meeting Content',
                description: 'Using AI for content queries',
                url: `${baseDocsUrl}/knowledgeai/How to Use the AI Assist Feature to Query Meeting Content_.docx.pdf`,
            },
            {
                title: 'How Can an Admin Add Users to Knowledge Assist',
                description: 'Adding users as an admin',
                url: `${baseDocsUrl}/knowledgeai/How Can an Admin Add Users to Knowledge Assist_.docx.pdf`,
            },
            {
                title: 'When Does Post-Analysis Become Available After the Meeting',
                description: 'Post-analysis availability',
                url: `${baseDocsUrl}/knowledgeai/When Does Post-Analysis Become Available After the Meeting_.docx.pdf`,
            },
        ],
    },
    {
        title: 'Train Assist',
        description: 'AI-powered training assistance for employees.',
        icon: <GraduateCapIcon color="#5856D6" />,
        tag: ProductsTags.TRANSITION_ASSIST,
        iconBgColor: '#5856D640',
        docs: [
            {
                title: 'Completing a Module in Train Assist',
                description: 'In Train Assist, a module consists of multiple topics. To complete a module, you must finish all topics and achieve 100% completion for each. This guide explains the process step-by-step.',
                url: `${baseDocsUrl}/train-assist/Completing a Module in Train Assist.pdf`,
            },
            {
                title: 'Completing a Topic in Train Assist',
                description: 'Step-by-Step Guide to Completing a Topic in Train Assist',
                url: `${baseDocsUrl}/train-assist/Completing a Topic in Train Assist.pdf`,
            },
            {
                title: 'Completing Quizzes in Train Assist',
                description: 'In Train Assist, quizzes are an essential part of the learning process. They help assess your understanding of the topics covered in a module. This guide explains how to complete a quiz, view your results, and understand the implications of passing or failing.',
                url: `${baseDocsUrl}/train-assist/Completing Quizzes in Train Assist.pdf`,
            },
            {
                title: 'Using AI Assist Chat in Train Assist',
                description: 'Using AI Assist Chat in Train Assist',
                url: `${baseDocsUrl}/train-assist/Using AI Assist Chat in Train Assist.pdf`,
            },
        ],
    },
    {
        title: 'Voice Co-Resolve',
        description: 'Explore features and usage of the Voice Co-Resolve module',
        icon: <RiChatVoiceLine size={24} color="#00C7BE" />,
        tag: ProductsTags.REACTIVE_MODULES,
        iconBgColor: '#00C7BE40',
        docs: [
            {
                title: 'How to View a User’s Previous Tickets in the Employee Details Section',
                description: 'Accessing user ticket history',
                url: `${baseDocsUrl}/voice-co-resolve/How to View a User’s Previous Tickets in the _Employee Details_ Section.pdf`,
            },
            {
                title: 'What Are the Primary Features Available in the Voice Co-Resolve Module',
                description: 'Overview of key features',
                url: `${baseDocsUrl}/voice-co-resolve/What Are the Primary Features Available in the Voice Co-Resolve Module_.docx.pdf`,
            },
            {
                title: 'How to Get Started with Voice Co-Resolve',
                description: 'Quick start guide',
                url: `${baseDocsUrl}/voice-co-resolve/How to Get Started with Voice Co-Resolve.pdf`,
            },
            {
                title: 'How to Use Voice Co-Resolve to Troubleshoot an Issue',
                description: 'Troubleshooting using Voice Co-Resolve',
                url: `${baseDocsUrl}/voice-co-resolve/How to Use Voice Co-Resolve to Troubleshoot an Issue.docx.pdf`,
            },
            {
                title: 'How to Use AI Suggestions to Assist Users in Real-Time',
                description: 'Real-time user assistance with AI',
                url: `${baseDocsUrl}/voice-co-resolve/How to Use AI Suggestions to Assist Users in Real-Time.pdf`,
            },
            {
                title: 'How to Listen to Audio Recordings in the Voice Co-Resolve Module',
                description: 'Accessing audio recordings',
                url: `${baseDocsUrl}/voice-co-resolve/How to Listen to Audio Recordings in the Voice Co-Resolve Module.pdf`,
            },
            {
                title: 'How to Initiate a New Call in Voice Co-Resolve',
                description: 'Starting a new call',
                url: `${baseDocsUrl}/voice-co-resolve/How to Initiate a New Call in Voice Co-Resolve.pdf`,
            },
            {
                title: 'How to Create an Incident Ticket for an Unresolved Issue',
                description: 'Creating incident tickets',
                url: `${baseDocsUrl}/voice-co-resolve/How to Create an Incident Ticket for an Unresolved Issue_.pdf`,
            },
            {
                title: 'How to Use the AI Assist Feature',
                description: 'Using the AI Assist feature',
                url: `${baseDocsUrl}/voice-co-resolve/How to Use the AI Assist Feature_.pdf`,
            },
            {
                title: 'Who Do I Contact If I Encounter Technical Issues with the Voice Co-Resolve Module',
                description: 'Technical support contact information',
                url: `${baseDocsUrl}/voice-co-resolve/Who Do I Contact If I Encounter Technical Issues with the Voice Co-Resolve Module.pdf`,
            },
            {
                title: 'How to Export Transcript, Summary, Keywords, and Sentiment Analysis',
                description: 'Exporting data for analysis',
                url: `${baseDocsUrl}/voice-co-resolve/How to Export Transcript, Summary, Keywords, and Sentiment Analysis_.pdf`,
            },
        ],
    },
    {
        title: 'Agent Assist',
        description: 'Guidance on using Agent Assist for incident management and support',
        icon: <GrUserExpert size={24} color="#AF52DE" />,
        tag: ProductsTags.REACTIVE_MODULES,
        iconBgColor: '#AF52DE40',
        docs: [
            {
                title: 'How to View the Status of an Ongoing Incident in Agent Assist',
                description: 'Checking incident status',
                url: `${baseDocsUrl}/agent-assist/How to View the Status of an Ongoing Incident in Agent Assist.pdf`,
            },
            {
                title: 'What to Do If Device Information Fails to Fetch in Agent Assist',
                description: 'Troubleshooting device information issues',
                url: `${baseDocsUrl}/agent-assist/What to Do If Device Information Fails to Fetch in Agent Assist.pdf`,
            },
            {
                title: 'How to Get Started with Agent Assist',
                description: 'Quick start guide',
                url: `${baseDocsUrl}/agent-assist/How to Get Started with Agent Assist_.docx.pdf`,
            },
            {
                title: 'How to Create a New Incident Using Agent Assist',
                description: 'Creating new incidents',
                url: `${baseDocsUrl}/agent-assist/How to Create a New Incident Using Agent Assist.docx.pdf`,
            },
            {
                title: 'How to Test the Multilingual Support Feature in Agent Assist',
                description: 'Testing multilingual support',
                url: `${baseDocsUrl}/agent-assist/How to Test the Multilingual Support Feature in Agent Assist.pdf`,
            },
            {
                title: 'How to Retrieve and Close Incidents in Agent Assist',
                description: 'Managing incidents',
                url: `${baseDocsUrl}/agent-assist/How to Retrieve and Close Incidents in Agent Assist.docx.pdf`,
            },
            {
                title: 'How to Search for and Retrieve Knowledge Base Articles in Agent Assist',
                description: 'Searching knowledge base articles',
                url: `${baseDocsUrl}/agent-assist/How to Search for and Retrieve Knowledge Base Articles in Agent Assist.docx.pdf`,
            },
            {
                title: 'What steps should I follow to access employee details using Agent Assist',
                description: 'Accessing employee details',
                url: `${baseDocsUrl}/agent-assist/What steps should I follow to access employee details using Agent Assist_.docx.pdf`,
            },
            {
                title: 'How to Create a Service Request in Agent Assist',
                description: 'Creating service requests',
                url: `${baseDocsUrl}/agent-assist/How to Create a Service Request in Agent Assist.pdf`,
            },
        ],
    },
    // Add more cards with their respective documentation...
];

export default HelpDocs;