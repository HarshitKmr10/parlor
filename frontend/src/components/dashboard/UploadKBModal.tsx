import React, {
  useState, useCallback, useRef, useEffect,
} from 'react';
import {
  Dialog, Flex, Button, Text, Box, Select, Spinner
} from '@radix-ui/themes';
import { toast, ToastContainer as ReactToastifyContainer } from 'react-toastify';
import { Upload, X, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from 'constants/dashboard';
import { useGlobalContext } from 'contexts/store';
import InputField from 'components/fields/InputField';
import { KbCollectionSource } from 'types/dashboard';
import { serviceDeskInstance } from 'api/common/axiosInstance';

interface Collection {
  id: string;
  name: string;
  source: string;
  source_config: Record<string, any>;
}

interface CollectionResponse {
  success: boolean;
  message: string;
  data: Collection[];
}

interface UploadKBModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (contents: string[], collectionId: string) => void;
  selectedCollectionId?: string;
  selectedCollectionName?: string;
  disableCollectionSelect?: boolean;
  onUploadComplete?: (filesUploaded: number) => void;
}

interface FileInputProps {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  files: File[];
  onRemoveFile: (index: number) => void;
  onFolderSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.html',
  '.htm',
];
const ACCEPTED_FILE_INPUT = ACCEPTED_FILE_EXTENSIONS.join(',');

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string | boolean;
    directory?: string | boolean;
    mozdirectory?: string | boolean;
  }
}

const FileInput: React.FC<FileInputProps> = ({
  onChange,
  onDrop,
  onDragOver,
  isDragging,
  files,
  onRemoveFile,
  onFolderSelect,
}) => {
  const { t } = useTranslation();
  
  return (
  <Flex direction="column" gap="2">
    <Box
      className={`
        border-2 border-dashed rounded-lg text-center
        transition-colors duration-200 cursor-pointer
        hover:bg-lightPrimary
        ${isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
        }
      `}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <input
        type="file"
        onChange={onFolderSelect}
        className="hidden cursor-pointer"
        id="folder-upload"
        webkitdirectory=""
        directory=""
        mozdirectory=""
        multiple
      />
      <input
        type="file"
        onChange={onChange}
        accept={ACCEPTED_FILE_INPUT}
        className="hidden cursor-pointer"
        id="file-upload"
        multiple
      />
      <label htmlFor="file-upload" className="block cursor-pointer p-4">
        <Upload className="mx-auto h-8 w-8 text-gray-400" />
        <div className="flex flex-col items-center">
          <Text size="2" className="mt-2">
            {t('uploadModal.dragDropText')}
          </Text>
          <Text size="1" color="gray" className="mt-1">
            {t('uploadModal.maxFileSize')}
          </Text>
        </div>
      </label>
    </Box>

    <Flex justify="center">
      <Button
        variant="soft"
        size="1"
        onClick={() => document.getElementById('folder-upload')?.click()}
      >
        {t('uploadModal.selectFolder')}
      </Button>
    </Flex>

    {files.length > 0 && (
      <Box className="mt-4 border-t pt-4">
        <Text size="2" weight="medium" className="mb-2 text-left">
          {t('uploadModal.selectedFiles', { count: files.length })}:
        </Text>
        <Flex
          direction="column"
          gap="2"
          className="max-h-[200px] overflow-y-auto pr-2"
        >
          {files.map((file, index) => (
            <Flex
              key={`${file.name}-${index}`}
              align="start"
              justify="between"
              className="bg-gray-50 p-2 rounded"
            >
              <Flex align="start" gap="2" className="flex-1">
                <FileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <Flex direction="column" className="flex-1 min-w-0">
                  <Text size="2" weight="medium" className="break-all">
                    {file.name}
                  </Text>
                  <Text size="1" color="gray">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                </Flex>
              </Flex>
              <Button
                variant="ghost"
                size="1"
                onClick={() => onRemoveFile(index)}
                className="text-gray-500 hover:text-red-500 flex-shrink-0 ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </Flex>
          ))}
        </Flex>
      </Box>
    )}
  </Flex>
  );
};

function UploadKBModal({
  isOpen,
  onClose,
  onUploadSuccess,
  selectedCollectionId,
  selectedCollectionName,
  disableCollectionSelect = false,
  onUploadComplete,
}: UploadKBModalProps) {
  const { t } = useTranslation();
  
  // Helper function for modal-specific toasts
  const showToast = {
    error: (message: string) => toast.error(message, { containerId: 'upload-modal-toasts' }),
    warning: (message: string) => toast.warning(message, { containerId: 'upload-modal-toasts' }),
    info: (message: string) => toast.info(message, { containerId: 'upload-modal-toasts' }),
    success: (message: string) => toast.success(message, { containerId: 'upload-modal-toasts' }),
  };
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [collectionName, setCollectionName] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useGlobalContext();
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [showCollectionError, setShowCollectionError] = useState(false);

  useEffect(() => {
    if (selectedCollectionId) {
      setSelectedCollection(selectedCollectionId);
    }
  }, [selectedCollectionId, isOpen]);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setIsLoadingCollections(true);

        // Use Knowledge Assist collections endpoint with RBAC
        const response = await serviceDeskInstance.get(API_ENDPOINTS.KNOWLEDGE_ASSIST_COLLECTIONS);

        if (response.status !== 200) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data;
        console.log('Collections data:', data);

        if (data.success && data.data) {
          // dont allow upload to ServiceNow and SharePoint collections
          setCollections(data.data.filter((collection: Collection) =>
            collection.source !== KbCollectionSource.SERVICE_NOW && collection.source !== KbCollectionSource.SHAREPOINT));
        } else {
          throw new Error(data.message || 'Failed to load collections');
        }
      } catch (error) {
        console.error('Detailed error:', error);
        showToast.error('Failed to load collections. Please try refreshing the page.');
        setError('Failed to load collections');
      } finally {
        setIsLoadingCollections(false);
      }
    };

    if (isOpen && !disableCollectionSelect && user?.access_token) {
      console.log('Conditions met, fetching collections');
      fetchCollections();
    }
  }, [isOpen, user?.access_token, disableCollectionSelect]);

  useEffect(() => {
    if (!isOpen) {
      setShowCollectionError(false);
    }
  }, [isOpen]);

  const getFileExtension = useCallback((fileName: string) => {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) {
      return '';
    }
    return fileName.slice(dotIndex).toLowerCase();
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    const fileExtension = getFileExtension(file.name);
    if (!fileExtension || !ACCEPTED_FILE_EXTENSIONS.includes(fileExtension)) {
      const normalizedExtension = fileExtension ? fileExtension.slice(1) : 'unknown';
      return t('uploadModal.invalidFileType', { extension: normalizedExtension, fileName: file.name });
    }
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return t('uploadModal.fileSizeExceeded', { fileName: file.name, size: fileSizeMB });
    }
    return null;
  }, [getFileExtension, t]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate each file
    selectedFiles.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        invalidFiles.push(validationError);
      } else {
        validFiles.push(file);
      }
    });

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      const errorMessage = invalidFiles.length === 1 
        ? invalidFiles[0]
        : t('uploadModal.multipleFilesHaveIssues', { count: invalidFiles.length, issues: invalidFiles.join('; ') });
      showToast.error(errorMessage);
    }

    // Add only valid files
    if (validFiles.length > 0) {
      setFiles(prevFiles => [...prevFiles, ...validFiles]);
      setError(null);
      
      if (invalidFiles.length > 0) {
        showToast.info(t('uploadModal.addedValidFiles', { validCount: validFiles.length, skippedCount: invalidFiles.length }));
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate each dropped file
    droppedFiles.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        invalidFiles.push(validationError);
      } else {
        validFiles.push(file);
      }
    });

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      const errorMessage = invalidFiles.length === 1 
        ? invalidFiles[0]
        : t('uploadModal.multipleFilesHaveIssues', { count: invalidFiles.length, issues: invalidFiles.join('; ') });
      showToast.error(errorMessage);
    }

    // Add only valid files
    if (validFiles.length > 0) {
      setFiles(prevFiles => [...prevFiles, ...validFiles]);
      setError(null);
      
      if (invalidFiles.length > 0) {
        showToast.info(t('uploadModal.addedValidFiles', { validCount: validFiles.length, skippedCount: invalidFiles.length }));
      }
    }
  };

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(true);
    },
    [],
  );

  const uploadSingleFile = async (file: File, collectionId: string) => {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('kb_collection_id', collectionId);

    try {

      const response = await serviceDeskInstance.post(API_ENDPOINTS.DOCUMENT, formData);

      if (response.status !== 200) {
        if (response.status === 413) {
          throw new Error(`File ${file.name} is too large. Maximum size allowed is 1MB`);
        }
        const errorData = response.data;
        throw new Error(
          `Failed to upload ${file.name}: ${JSON.stringify(errorData.detail)}`,
        );
      }

      return response.data;
    } catch (error) {
      console.error('Upload error for file:', file.name, error);
      throw error;
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedCollection) {
      setShowCollectionError(true);
      return;
    }
    setShowCollectionError(false);
    if (files.length === 0) return;

    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    // Update to use MAX_FILE_SIZE instead of hardcoded 1MB
    const validFiles = [];
    const oversizedFiles = [];

    files.forEach((file) => {
      if (file.size <= MAX_FILE_SIZE) {
        validFiles.push(file);
      } else {
        oversizedFiles.push(`${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      }
    });

    if (oversizedFiles.length > 0) {
      showToast.error(`Following files exceed 10MB limit: ${oversizedFiles.join(', ')}`);
    }

    if (validFiles.length === 0) {
      setIsLoading(false);
      return;
    }

    let successCount = 0;
    const failedFiles: string[] = [];

    try {
      // Upload files in batches of 5
      const BATCH_SIZE = 5;
      for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
        const batch = validFiles.slice(i, i + BATCH_SIZE);
        const formData = new FormData();

        // Add all files in the batch to the same FormData
        batch.forEach(file => {
          formData.append('files', file);
        });
        formData.append('kb_collection_id', selectedCollection);

        try {
          const response = await serviceDeskInstance.post(API_ENDPOINTS.DOCUMENT, formData);
          successCount += batch.length;
          setUploadProgress(Math.round((successCount / validFiles.length) * 100));
          console.log(`Successfully uploaded batch of ${batch.length} files`);

          // Add delay between batches
          if (i + BATCH_SIZE < validFiles.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error: any) {
          console.error(`Error uploading batch: ${error}`);
          batch.forEach(file => failedFiles.push(file.name));
          
          // Parse and display detailed error message
          let errorMessage = `Failed to upload batch starting with ${batch[0].name}`;
          if (error?.response?.data?.detail) {
            errorMessage = error.response.data.detail;
          } else if (error?.message) {
            errorMessage = error.message;
          }
          
          showToast.error(errorMessage);
        }
      }

      if (successCount > 0) {
        if (onUploadComplete) {
          onUploadComplete(successCount);
        }
        onUploadSuccess([], selectedCollection);
        setFiles([]);
        onClose();
      }

      // Show final results
      if (failedFiles.length > 0 || oversizedFiles.length > 0) {
        const failedMessage = failedFiles.length > 0
          ? `Failed files: ${failedFiles.join(', ')}. `
          : '';
        const oversizedMessage = oversizedFiles.length > 0
          ? `Oversized files: ${oversizedFiles.join(', ')}`
          : '';

        showToast.warning(
          `Uploaded ${successCount} out of ${files.length} files. ${failedMessage}${oversizedMessage}`
        );
      } else {
        showToast.success(`Successfully uploaded and processing all ${validFiles.length} files!`);
        setFiles([]);
      }
    } catch (error: any) {
      console.error('Upload error details:', error);
      let errorMessage = 'Failed to upload files. Please try again.';
      
      // Parse detailed error message from backend
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [files, selectedCollection, onUploadSuccess, onClose, user?.access_token, onUploadComplete]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setFiles([]);
      setError(null);
      setIsDragging(false);
      if (!selectedCollectionId) {
        setSelectedCollection('');
      }
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, 200);
  }, [onClose, selectedCollectionId]);

  const getTooltipMessage = () => {
    if (!selectedCollection) return 'Please select a collection';
    if (files.length === 0) return 'Please select files to upload';
    if (isLoading) return 'Upload in progress';
    return null;
  };

  const handleFolderSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []).map(file => {
      // Create a new File object with the base name instead of the full path
      const baseName = file.name.split('/').pop() || file.name;
      return new File([file], baseName, { type: file.type });
    });

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate each file from the folder
    selectedFiles.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        invalidFiles.push(validationError);
      } else {
        validFiles.push(file);
      }
    });


    if (validFiles.length === 0) {
      if (invalidFiles.length > 0) {
        const errorSample = invalidFiles.slice(0, 3).join('; ');
        const moreText = invalidFiles.length > 3 ? ` and ${invalidFiles.length - 3} more` : '';
        showToast.error(`No valid files found in folder. Issues: ${errorSample}${moreText}`);
      } else {
        showToast.warning(t('uploadModal.noValidFilesFoundInFolder'));
      }
      return;
    }

    setFiles(prevFiles => [...prevFiles, ...validFiles]);
    setError(null);

    if (invalidFiles.length > 0) {
      showToast.info(
        `Found ${validFiles.length} valid files out of ${selectedFiles.length} total files. ` +
        `${invalidFiles.length} files skipped due to validation issues.`
      );
    } else {
      showToast.success(`Found ${validFiles.length} valid files in the folder.`);
    }
  }, [t, validateFile]);

  const handleCollectionChange = (value: string) => {
    setSelectedCollection(value);
    setShowCollectionError(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Content style={{ maxWidth: 500 }}>
        <Dialog.Title>{t('uploadModal.title')}</Dialog.Title>

        <Flex direction="column" gap="3" className="my-4">
          {!disableCollectionSelect ? (
            <Box>
              <Text as="label" size="2" weight="medium" className="mb-2 block">
                {t('uploadModal.selectCollection')}
              </Text>
              {isLoadingCollections ? (
                <Flex align="center" justify="center" py="4">
                  <Spinner size="2" />
                </Flex>
              ) : collections.length === 0 ? (
                <Flex direction="column" gap="2">
                  <Box className="bg-red-50 border border-red-200 rounded-md p-3">
                    <Flex gap="2" align="center">
                      <Text size="2" color="red">
                        {t('uploadModal.noCollectionsFound')}
                      </Text>
                    </Flex>
                  </Box>
                </Flex>
              ) : (
                <Select.Root
                  value={selectedCollection}
                  onValueChange={handleCollectionChange}
                  disabled={disableCollectionSelect}
                >
                  <Select.Trigger
                    className="w-full"
                    placeholder={t('uploadModal.chooseCollection')}
                  />
                  <Select.Content>
                    <Select.Group>
                      {collections.map((collection) => (
                        <Select.Item key={collection.id} value={collection.id}>
                          <Flex direction="column" gap="1">
                            <Text>{collection.name}</Text>
                          </Flex>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              )}
              {showCollectionError && (
                <Text size="2" color="red" className="mb-2">
                  {t('uploadModal.pleaseSelectCollection')}
                </Text>
              )}
            </Box>
          ) : (
            <Box>
              <InputField
                id="selectedCollectionName"
                label={t('uploadModal.selectedCollection')}
                placeholder={t('uploadModal.selectedCollection')}
                value={selectedCollectionName}
                disabled
              />
            </Box>
          )}

          <FileInput
            onChange={handleFileChange}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            isDragging={isDragging}
            files={files}
            onRemoveFile={handleRemoveFile}
            onFolderSelect={handleFolderSelect}
          />

          {!!error && (
            <Text color="red" size="1" className="mt-1">
              {error}
            </Text>
          )}

          {isLoading && uploadProgress > 0 && (
            <Box>
              <Text size="2">
                {t('uploadModal.uploadProgress')}: {uploadProgress}%
              </Text>
              <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </Box>
          )}
        </Flex>

        <Flex gap="3" justify="end">
          <Button
            variant="soft"
            color="gray"
            onClick={handleClose}
            disabled={isLoading}
          >
            {t('uploadModal.cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || isLoading}
          >
            {isLoading
              ? t('uploadModal.uploading')
              : t('uploadModal.upload', { count: files.length })}
          </Button>
        </Flex>
        
        {/* ToastContainer within the Dialog's stacking context - only when modal is open */}
        {isOpen && (
          <ReactToastifyContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            closeOnClick={true}
            pauseOnHover={true}
            draggable={true}
            containerId="upload-modal-toasts"
            enableMultiContainer
            style={{ zIndex: 9999 }}
          />
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default React.memo(UploadKBModal);
