'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Text, Button, Box } from '@radix-ui/themes';
import CustomAvatar from 'components/CustomAvatar';
import { UserType } from 'types/common';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from '@/contexts/store';
import useUserRoles from 'hooks/useUserRoles';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';

interface UserDropdownProps {
  user: UserType | null;
  handleLogout: () => void;
}

function UserDropdown({ user, handleLogout }: UserDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { setUser, setSelectedTeam } = useGlobalContext();
  const roles = useUserRoles();

  // Detect click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('selectedTeam');
    localStorage.removeItem('ACCESS_TOKEN');
    localStorage.removeItem('REFRESH_TOKEN');
    sessionStorage.clear();
    router.push('/login');
    setUser(null);
    setSelectedTeam(null);

    if (process.env.NEXT_PUBLIC_OAUTH_LOGOUT_URL) {
      window.location.href = process.env.NEXT_PUBLIC_OAUTH_LOGOUT_URL;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Box className="cursor-pointer" onClick={() => setOpen((prev) => !prev)}>
        <CustomAvatar
          src={user?.profile_pic}
          name={user?.name}
          alt="profile"
          height="26px"
          width="26px"
        />
      </Box>

      {open && (
        <div className="absolute left-10 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50 bottom-0">
          <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b">
            {t('navbar.hey', { name: user?.name })}
          </div>
          <ul className="py-2">
            <li>
              <a
                href="/profile"
                className="block px-4 py-2 text-sm text-gray-800 dark:text-white hover:bg-[var(--accent-9)] hover:text-white transition-colors"
              >
                {t('navbar.profileSettings')}
              </a>
            </li>
            {(roles.train_assist_admin || roles.knowledge_assist_admin || roles.agent_assist_admin || roles.is_tag_lead) && (
              <li>
                <a
                  href="/admin/users/users-overview"
                  className="block px-4 py-2 text-sm text-gray-800 dark:text-white hover:bg-[var(--accent-9)] hover:text-white transition-colors"
                >
                  {t('navbar.adminPanel')}
                </a>
              </li>
            )}
            {roles.platform_admin ? (
              <li>
                <a
                  href="/security"
                  className="block px-4 py-2 text-sm text-gray-800 dark:text-white hover:bg-[var(--accent-9)] hover:text-white transition-colors"
                >
                  Security
                </a>
              </li>
            ) : null}
            <li>
              <button
                onClick={() => {
                  setFeedbackOpen(true);
                  setOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-white hover:bg-[var(--accent-9)] hover:text-white transition-colors"
              >
                {t('navbar.sendFeedback')}
              </button>
            </li>
          </ul>
          <div className="px-4 py-2 border-t">
            <Button
              className="w-full cursor-pointer hover:bg-red-500/80 hover:text-white"
              color="red"
              variant="soft"
              onClick={() => {
                logout();
                setOpen(false);
              }}
            >
              {t('navbar.logout')}
            </Button>
          </div>
        </div>
      )}
      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}

export default UserDropdown;