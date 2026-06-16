import React, { useState } from 'react';
import Modal from 'react-modal';
import { Box, Button, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import { useCopilotStore } from 'store/Copilot';
import { toast } from 'react-toastify';

type Props = {
  open: boolean;
  onClose: () => void;
};

function UserSearchModal({ open, onClose }: Props) {
  const [searchType, setSearchType] = useState<'email' | 'employee_number' | 'user_id'>('email');
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchUserByEmailOrEmployeeNumber = useCopilotStore(
    (state) => state.searchUserByEmailOrEmployeeNumber
  );

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError('Please enter a value to search');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const result = await searchUserByEmailOrEmployeeNumber(
        searchType === 'email' ? searchValue.trim() : undefined,
        searchType === 'employee_number' ? searchValue.trim() : undefined,
        searchType === 'user_id' ? searchValue.trim() : undefined
      );

      if (result) {
        toast.success('User found successfully!');
        handleClose();
      } else {
        const fieldName = searchType === 'email' ? 'email' : searchType === 'employee_number' ? 'employee number' : 'user ID';
        setError(`No user found with this ${fieldName}`);
      }
    } catch (e: any) {
      setError(`Error searching user: ${e.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClose = () => {
    setSearchValue('');
    setError(null);
    setSearchType('email');
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onRequestClose={handleClose}
      className={clsx(
        'relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
        'w-[90%] max-w-[500px] bg-white dark:bg-navy-700 rounded-xl shadow-xl',
        'outline-none'
      )}
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 z-50"
      contentLabel="User Search"
    >
      <Box className="p-6">
        <Flex direction="column" gap="4">
          {/* Header */}
          <Flex align="center" justify="between" className="mb-2">
            <Text size="5" weight="bold" className="text-gray-900 dark:text-white">
              User Not Found
            </Text>
            <button 
              onClick={handleClose} 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-500 dark:text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Flex>

          {/* Description */}
          <Text size="2" className="text-gray-600 dark:text-gray-400 -mt-2 mb-5">
            No user found with the provided phone number. Please enter an email, employee number, or user ID.
          </Text>

          {/* Search Type Toggle */}
          <Flex gap="2" className="w-full">
            <Button
              variant={searchType === 'email' ? 'solid' : 'outline'}
              color="iris"
              size="2"
              onClick={() => {
                setSearchType('email');
                setSearchValue('');
                setError(null);
              }}
              className="flex-1 cursor-pointer"
            >
              Email
            </Button>
            <Button
              variant={searchType === 'employee_number' ? 'solid' : 'outline'}
              color="iris"
              size="2"
              onClick={() => {
                setSearchType('employee_number');
                setSearchValue('');
                setError(null);
              }}
              className="flex-1 cursor-pointer"
            >
              Employee #
            </Button>
            <Button
              variant={searchType === 'user_id' ? 'solid' : 'outline'}
              color="iris"
              size="2"
              onClick={() => {
                setSearchType('user_id');
                setSearchValue('');
                setError(null);
              }}
              className="flex-1 cursor-pointer"
            >
              User ID
            </Button>
          </Flex>

          {/* Input Field */}
          <Flex direction="column" gap="1">
            <label 
              htmlFor="searchValue" 
              className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-5"
            >
              {searchType === 'email' ? 'Email Address' : searchType === 'employee_number' ? 'Employee Number' : 'User ID'}
            </label>
            <input
              id="searchValue"
              name="searchValue"
              type={searchType === 'email' ? 'email' : 'text'}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              disabled={isSearching}
              placeholder={searchType === 'email' ? 'user@example.com' : searchType === 'employee_number' ? 'EMP12345' : 'john.doe'}
              className={clsx(
                'w-full px-3 py-2 rounded-md border',
                'bg-white dark:bg-gray-800',
                'text-gray-900 dark:text-white',
                'placeholder-gray-400 dark:placeholder-gray-500',
                error 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 dark:border-gray-600 focus:border-iris-9 focus:ring-iris-9',
                'focus:outline-none focus:ring-2 focus:ring-opacity-50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchValue.trim() && !isSearching) {
                  handleSearch();
                }
              }}
            />
          </Flex>

          {/* Error Message */}
          {!!error && (
            <Flex 
              align="center" 
              gap="2" 
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"
            >
              <svg 
                className="h-5 w-5 text-red-500 flex-shrink-0" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <Text size="2" className="text-red-700 dark:text-red-400">
                {error}
              </Text>
            </Flex>
          )}

          {/* Action Buttons */}
          <Flex gap="3" justify="end" className="mt-2">
            <button
              onClick={handleClose}
              disabled={isSearching}
              className={clsx(
                'px-4 py-2 rounded-md font-medium text-sm transition-colors mx-5',
                'border border-gray-300 dark:border-gray-600',
                'text-gray-700 dark:text-gray-300',
                'hover:bg-gray-50 dark:hover:bg-gray-800',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50'
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchValue.trim()}
              className={clsx(
                'px-4 py-2 rounded-md font-medium text-sm transition-colors min-w-[130px]',
                'bg-iris-9 hover:bg-iris-10 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-iris-9',
                'focus:outline-none focus:ring-2 focus:ring-iris-9 focus:ring-opacity-50',
                'flex items-center justify-center gap-2'
              )}
            >
              {isSearching ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Searching...</span>
                </>
              ) : (
                'Search User'
              )}
            </button>
          </Flex>
        </Flex>
      </Box>
    </Modal>
  );
}

export default UserSearchModal;
