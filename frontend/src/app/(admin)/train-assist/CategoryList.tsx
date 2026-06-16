// src/components/Dashboard/CategoryList.tsx
import React from 'react';
import {
  Box, Card, Flex, Text, Progress,
} from '@radix-ui/themes';
import {
  Laptop, Database, Network, Server, Briefcase,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CategoryListProps {
  categories: any;
}

function CategoryList({ categories }: CategoryListProps) {
  const router = useRouter();

  const handleCategoryClick = (category: string) => {
    router.push(`/train-assist/learn/${category.toLowerCase()}`);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Software':
        return <Laptop className="h-10 w-10 text-white" />;
      case 'Database':
        return <Database className="h-10 w-10 text-white" />;
      case 'Network':
        return <Network className="h-10 w-10 text-white" />;
      case 'Server':
        return <Server className="h-10 w-10 text-white" />;
      case 'Business Processes':
        return <Briefcase className="h-10 w-10 text-white" />;
      default:
        return null;
    }
  };

  return (
    <Flex direction="column" gap="4" mt="4">
      <Text size="7" weight="medium" color="gray">
        Categories to Learn
      </Text>
      {categories.map((category, index) => (
        <Card
          key={index}
          onClick={() => handleCategoryClick(category.name)}
          style={{ cursor: 'pointer' }}
          className="p-4"
        >
          <Flex>
            <Flex
              align="center"
              justify="center"
              className="bg-[var(--accent-9)]"
              style={{ padding: '16px', borderRadius: '8px' }}
            >
              {getCategoryIcon(category.name)}
            </Flex>
            <Flex
              direction="column"
              justify="between"
              style={{ marginLeft: '12px', width: '100%' }}
              className="py-1"
            >
              <Text size="6" weight="bold" color="iris">
                {category.name}
              </Text>
              <Box>
                <Text size="2" style={{ marginBottom: '8px' }}>
                  <Text weight="bold">{category.completedModules}</Text>
                  /
                  {category.totalModules}
                  {' '}
                  modules
                  {' | '}
                  <Text weight="bold">
                    {category.completionPercentage}
                    %
                  </Text>
                </Text>
                <Progress
                  value={category.completionPercentage}
                  size="2"
                  style={{ borderRadius: '9999px' }}
                />
              </Box>
            </Flex>
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}

export default CategoryList;
