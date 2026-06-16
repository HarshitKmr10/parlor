import React, { useState, useCallback } from 'react';
import {
  Dialog, Flex, Text, Button, DropdownMenu,
} from '@radix-ui/themes';
import { KbCollection, useKnowledgeBase } from 'hooks/useKnowledgeBase';
import { useDropzone } from 'react-dropzone';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import TextField from 'components/fields/TextField';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface CreateArticleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateArticle: (
    collectionId: string,
    title: string,
    content: string
  ) => Promise<void>;
  kbCollections: any;
}

function CreateArticleDialog({
  isOpen,
  onOpenChange,
  onCreateArticle,
  kbCollections,
}: CreateArticleDialogProps) {
  const [selectedCollection, setSelectedCollection] = useState('');
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);

  const convertPdfToText = async (pdfFile: File): Promise<string> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `${pageText}\n\n`;
    }

    return fullText;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (
      acceptedFiles.length > 0
      && acceptedFiles[0].type === 'application/pdf'
    ) {
      setUploadedFile(acceptedFiles[0]);
      setIsConverting(true);
      try {
        const text = await convertPdfToText(acceptedFiles[0]);
        setPdfText(text);
      } catch (error) {
        console.error('Error converting PDF:', error);
      }
      setIsConverting(false);
    } else {
      console.error('Please upload a PDF file.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCollection && title && pdfText) {
      await onCreateArticle(selectedCollection, title, pdfText);
      onOpenChange(false);
      setSelectedCollection('');
      setTitle('');
      setUploadedFile(null);
      setPdfText('');
    }
  };

  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 600 }}>
        <Dialog.Title>Upload Document</Dialog.Title>
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="3">
            <Text as="div" size="2" mb="1" weight="bold">
              Collection
            </Text>
            <DropdownMenu.Root onOpenChange={setCollectionMenuOpen}>
              <DropdownMenu.Trigger className="p-2 rounded-md outline outline-offset-3 outline-[1.5px] outline-[var(--gray-7)]">
                <Button variant="outline" className="justify-between w-full">
                  {kbCollections.find((c) => c.sys_id === selectedCollection)
                    ?.title || 'Select collection'}
                  {collectionMenuOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {kbCollections.map((collection) => (
                  <DropdownMenu.Item
                    key={collection.sys_id}
                    onSelect={() => handleCollectionChange(collection.sys_id)}
                  >
                    {collection.title}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <TextField
              id="title"
              label="Title"
              placeholder="Enter article title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={1}
            />

            <Flex direction="column" gap="2">
              <Text as="div" size="2" weight="bold">
                Upload PDF File (Required)
              </Text>
              <div
                {...getRootProps()}
                style={{
                  border: '2px dashed var(--gray-6)',
                  borderRadius: '4px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <input {...getInputProps()} />
                {!uploadedFile
                  && (isDragActive ? (
                    <p>Drop the PDF file here ...</p>
                  ) : (
                    <p>
                      Drag &apos;n&apos; drop a PDF file here, or click to
                      select a file
                    </p>
                  ))}
                {uploadedFile && (
                  <p>
                    Selected file:
                    {uploadedFile.name}
                  </p>
                )}
                {isConverting && <p>Converting PDF to text...</p>}
              </div>
            </Flex>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={
                  !selectedCollection || !title || !pdfText || isConverting
                }
              >
                Upload Article
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default CreateArticleDialog;
