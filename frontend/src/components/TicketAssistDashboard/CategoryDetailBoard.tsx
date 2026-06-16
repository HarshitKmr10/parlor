'use client';
import React from 'react';
import InfoCard from './InfoCard'; 
import { Text, Spinner, Callout } from '@radix-ui/themes';
import { AlertTriangle } from 'lucide-react'; 

interface CategoryDetailBoardProps {
  categoryName: string; 
  onCardClick: (cardData: any) => void; 
  data: any | null; // Use any for now
  loading: boolean;
  error: Error | null;
}

const CategoryDetailBoard: React.FC<CategoryDetailBoardProps> = ({ 
    categoryName, 
    onCardClick, 
    data,
    loading,
    error
}) => {

  if (loading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Spinner size="3" />
        <Text ml="2">Loading {categoryName} details...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <Callout.Root color="red" role="alert" my="4">
        <Callout.Icon>
          <AlertTriangle />
        </Callout.Icon>
        <Callout.Text>
          Error loading category details: {error.message}
        </Callout.Text>
      </Callout.Root>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-center p-10 text-gray-500">
        No data available for {categoryName}.
      </div>
    );
  }
  
  const columnsToDisplay = Object.entries(data) as [string, any[]][]; 

  return (
    <div className="h-[calc(100vh-200px)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 h-full">
        {columnsToDisplay.map(([columnTitle, cards]: [string, any[]]) => { 
          const totalIssuesInColumn = cards.reduce((sum: number, card: any) => sum + (card?.issueCount || 0), 0);
          return (
            <div key={columnTitle} className="bg-gray-50 rounded-lg border border-gray-200 flex flex-col h-full">
              <div className="p-3 pb-0 flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <Text size="2" weight="medium" className="text-gray-700">{columnTitle}</Text>
                  <Text size="1" className="text-gray-500">({totalIssuesInColumn.toLocaleString()})</Text>
                </div>
                <hr className="mb-3"/>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <div className="space-y-2">
                  {cards.map((card: any, index: number) => (
                    <InfoCard 
                      key={`${columnTitle}-${card?.platform || index}-${index}`}
                      title={columnTitle} 
                      platform={card?.platform || 'N/A'}
                      issueCount={card?.issueCount || 0}
                      employeeCount={card?.employeeCount || 0}
                      kbStatus={card?.kbStatus ? 'KB Found' : 'KB Not Found'} 
                      timeToResolution={card?.ttr ?? 'N/A'} 
                      onClick={() => onCardClick({ 
                        ...card, 
                        columnTitle: columnTitle, 
                        timeToResolution: card?.ttr 
                      })} 
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

};

export default CategoryDetailBoard; 