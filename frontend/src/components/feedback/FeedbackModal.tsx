'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/common/Dialog';
import { Button, Text, TextArea, Flex } from '@radix-ui/themes';
import { toast } from 'react-toastify';
import { X, Upload, Loader2 } from 'lucide-react';
import { Feedback } from '@/api/feedback';
import { useTranslation } from 'react-i18next';

const CATEGORIES = [
  { id: 'bug', label: 'Bug', icon: '🐛' },
  { id: 'feature_request', label: 'Feature Request', icon: '💡' },
  { id: 'ui_ux', label: 'UI/UX', icon: '🎨' },
  { id: 'performance', label: 'Performance', icon: '⚡' },
  { id: 'other', label: 'Other', icon: '💬' },
];

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  workItemId?: string | null;
  chatSessionId?: string | null;
}

export function FeedbackModal({
  open,
  onOpenChange,
  workspaceId,
  workItemId,
  chatSessionId
}: FeedbackModalProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>('');
  const [content, setContent] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!category || content.length < 10) {
      toast.error('Please select a category and provide at least 10 characters of feedback');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Upload screenshots first if any
      let screenshotUrls: string[] = [];
      if (screenshots.length > 0) {
        setUploading(true);
        try {
          screenshotUrls = await Feedback.uploadScreenshots(screenshots);
        } catch (uploadError: any) {
          console.error('Failed to upload screenshots:', uploadError);
          toast.warning('Screenshots upload failed, but continuing with feedback submission...');
        } finally {
          setUploading(false);
        }
      }

      // Step 2: Submit feedback with screenshot URLs
      const response = await Feedback.submitFeedback({
        category,
        content,
        page_url: window.location.href,
        screenshot_urls: screenshotUrls.length > 0 ? screenshotUrls : undefined,
        workspace_id: workspaceId,
        work_item_id: workItemId,
        chat_session_id: chatSessionId,
      });

      if (response.success) {
        toast.success('Thank you for your feedback! We appreciate your input and will review it shortly.');
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(response.message || 'Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      const errorMessage = error.message || 'Failed to submit feedback. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCategory('');
    setContent('');
    setScreenshots([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);

    if (validFiles.length < files.length) {
      toast.warning('Some files were skipped (must be images under 10MB)');
    }

    setScreenshots(prev => [...prev, ...validFiles].slice(0, 5));

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (!submitting && !uploading) {
      onOpenChange(false);
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Category Selection */}
          <div className="flex flex-col gap-2">
            <Text size="2" weight="bold" className="text-gray-9">
              Category *
            </Text>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border transition-all ${
                    category === cat.id
                      ? 'border-[var(--accent-9)] bg-[var(--accent-2)] shadow-[0_0_0_1px_var(--accent-9)]'
                      : 'border-[var(--gray-6)] bg-[var(--gray-2)] hover:border-[var(--accent-9)] hover:bg-[var(--gray-3)]'
                  }`}
                  onClick={() => setCategory(cat.id)}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className={`text-xs ${
                    category === cat.id
                      ? 'text-[var(--accent-11)] font-medium'
                      : 'text-[var(--gray-11)]'
                  }`}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Text */}
          <div className="flex flex-col gap-2">
            <Text size="2" weight="bold" className="text-gray-9">
              Your Feedback *
            </Text>
            <TextArea
              placeholder="Please describe your feedback in detail..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-vertical rounded-md p-2"
              style={{ minHeight: '120px' }}
              rows={5}
              maxLength={10000}
            />
            <Text size="1" className="text-right text-[var(--gray-10)]">
              {content.length}/10000
            </Text>
          </div>

          {/* Screenshot Upload */}
          <div className="flex flex-col gap-2">
            <Text size="2" weight="bold" className="text-gray-9">
              Screenshots (optional)
            </Text>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              hidden
            />
            <button
              type="button"
              className={`flex items-center gap-2 px-4 py-2 rounded-md border border-dashed transition-all w-fit text-sm ${
                screenshots.length >= 5
                  ? 'opacity-50 cursor-not-allowed'
                  : 'border-[var(--gray-6)] text-[var(--gray-11)] hover:border-[var(--accent-9)] hover:text-[var(--accent-11)]'
              }`}
              onClick={() => fileInputRef.current?.click()}
              disabled={screenshots.length >= 5}
            >
              <Upload size={16} />
              Add Screenshot ({screenshots.length}/5)
            </button>

            {screenshots.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {screenshots.map((file, index) => (
                  <div
                    key={index}
                    className="relative w-20 h-20 rounded-md overflow-hidden border border-[var(--gray-6)]"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeScreenshot(index)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-3 justify-end mt-4">
          <Button
            variant="soft"
            onClick={handleClose}
            disabled={submitting || uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading || !category || !content.trim() || content.length < 10}
            style={{ backgroundColor: 'var(--accent-9)', color: 'white' }}
          >
            {(submitting || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {uploading ? 'Uploading...' : submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
