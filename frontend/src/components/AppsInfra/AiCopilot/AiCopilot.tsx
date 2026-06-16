'use client';

// ─────────────────────────────────────────────────────────────
// React & Next.js
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────
// UI Libraries
// ─────────────────────────────────────────────────────────────
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────
// Icons & Components
// ─────────────────────────────────────────────────────────────
import { PlusCircleIcon } from 'lucide-react';
import AppBotIcon from 'components/icons/AppBotIcon';

// ─────────────────────────────────────────────────────────────
// APIs & Context
// ─────────────────────────────────────────────────────────────
import { useGlobalContext } from 'contexts/store';
import Link from 'next/link';
import { useAppsInfraStore } from 'store/AppAndInfra/AppInfra';

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────
interface DashBoardCard {
  id?: string;
  title: string;
  description: string;
  url: string;
}

// ─────────────────────────────────────────────────────────────
// Animation Variants
// ─────────────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Stagger children by 0.1s
      delayChildren: 0.2,   // Start after 0.2s
    },
  },
};

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
    },
  },
  hover: {
    y: -4,
    scale: 1.02,
    transition: {
      duration: 0.2,
    },
  },
};

const createCardVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
    rotate: -5,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    rotate: 0,
    transition: {
      duration: 0.5,
    },
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Main Component: AiCopilot
// ─────────────────────────────────────────────────────────────
function AiCopilot() {
  // ─── Global Context: User & Organization ───────────────────────────────
  const { organization, user } = useGlobalContext();
  const apps = useAppsInfraStore((s) => s.apps);
  const appsLoading = useAppsInfraStore((s) => s.appsLoading);

  // ─── Local State ───────────────────────────────────────────────────────
  const [showCreateNewApp, setShowCreateNewApp] = useState(true);

  // ─── Determine Permission to Show "Create New App" ─────────────────────
  useEffect(() => {
    try {
      if (!organization || !user) return;
      
      const config = JSON.parse(organization.config);
      if (config.CustomAppsEnabled && user.role === 'Admin') {
        setShowCreateNewApp(true);
      }
    } catch (error) {
      console.error(`Error parsing organization config: ${error}`);
    }
  }, [organization, user?.role]);

  // ─── Transform Apps Data ───────────────────────────────────────────────
  const transformedApps = useMemo(() => {
    return apps.map((app) => ({
      id: app.id,
      title: app.name,
      description: app.description,
      url: `/apps/${app.id}/?appName=${app.name}`,
    }));
  }, [apps]);

  // ─── Render Create New App Card ───────────────────────────────────────
  const renderCreateNewAppCard = () => {
    if (!showCreateNewApp) return null;

    return (
      <motion.div
        variants={createCardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        className="w-full cursor-pointer"
      >
        <Link href="/apps/create" className="w-full">
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-white px-4 py-6 transition-colors hover:border-[#5b5bd6] hover:shadow-sm">
            <PlusCircleIcon size="24px" color="gray" />
            <span className="text-base font-medium text-gray-600">
              Create New App
            </span>
          </div>
        </Link>
      </motion.div>
    );
  };

  // ─── Render App Card ──────────────────────────────────────────────────
  const renderAppCard = (card: DashBoardCard, index: number) => (
    <motion.div
      key={card?.id ?? card.title}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="flex justify-stretch"
    >
      <Link href={card.url} className="w-full">
        <div className="flex w-full cursor-pointer flex-row gap-3 rounded-xl border bg-white px-4 py-3 transition-colors hover:border-iris-9 hover:shadow-sm min-h-32">
          {/* App Icon */}
          <div className="flex flex-row items-start">
            <AppBotIcon />
          </div>

          {/* App Details */}
          <div className="flex flex-1 flex-col items-start gap-1">
            <span className="line-clamp-2 text-base font-medium text-iris-9">
              {card.title}
            </span>
            <span className="line-clamp-2 text-sm text-gray-600">
              {card.description}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );

  // ─── Loading State ────────────────────────────────────────────────────
  if (appsLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-y-auto px-4">
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* Loading skeleton cards */}
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="h-32 w-full animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mt-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* Create New App Card */}
          <AnimatePresence>
            {renderCreateNewAppCard()}
          </AnimatePresence>

          {/* App Cards */}
          <AnimatePresence>
            {transformedApps.map((card, index) => renderAppCard(card, index))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default AiCopilot;