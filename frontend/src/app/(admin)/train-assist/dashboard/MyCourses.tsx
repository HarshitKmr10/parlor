import React from 'react';
import {
  Box, Card, Flex, Text, ScrollArea, Progress,
} from '@radix-ui/themes';
import * as Accordion from '@radix-ui/react-accordion';
import {
  Laptop,
  Database,
  Network,
  Server,
  ChevronDown,
  ChevronUp,
  Icon,
} from 'lucide-react';

type SubCourse = {
  name: string;
  duration: string;
  quizzes: number;
};

type Course = {
  name: string;
  icon: Icon;
  modules: number;
  completedModules: number;
  subCourses: SubCourse[];
};

type CourseCardProps = {
  course: Course;
  index: number;
};

const iconMap: { [key: string]: Icon } = {
  Laptop,
  Database,
  Network,
  Server,
};

function CourseCard({ course, index }: CourseCardProps) {
  const completionPercentage = Math.round(
    (course.completedModules / course.modules) * 100,
  );

  return (
    <Accordion.Item value={`item-${index}`} className="w-full">
      <Box className="mb-4 w-full bg-white rounded-md shadow-sm">
        <Accordion.Header>
          <Accordion.Trigger className="w-full">
            <Flex className="p-4 items-start">
              <Flex
                className="bg-[var(--accent-9)] flex-shrink-0"
                style={{ padding: '16px', borderRadius: '8px' }}
              >
                {React.createElement(iconMap[course.icon.name] || course.icon, {
                  className: 'h-10 w-10 text-white',
                })}
              </Flex>
              <Flex
                direction="column"
                justify="between"
                align="start"
                style={{ marginLeft: '12px', flex: 1 }}
                className="py-1"
              >
                <Text size="6" weight="bold" color="iris" className="mb-2">
                  {course.name}
                </Text>
                <Box className="w-full">
                  <Flex direction="column" align="start" className="w-full">
                    <Text size="2" style={{ marginBottom: '4px' }}>
                      <Text weight="bold">{course.completedModules}</Text>
                      /
                      {course.modules}
                      {' '}
                      modules
                      {' | '}
                      <Text weight="bold">
                        {completionPercentage}
                        %
                      </Text>
                    </Text>
                    <Progress
                      value={completionPercentage}
                      size="2"
                      style={{ width: '100%' }}
                    />
                  </Flex>
                </Box>
              </Flex>
              <ChevronDown className="h-4 w-4 text-gray-500 ml-4 flex-shrink-0 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
            </Flex>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          <Box className="p-4 pt-0 max-h-48 overflow-y-auto">
            {course.subCourses.map((subCourse, subIndex) => (
              <Box
                key={subIndex}
                className="py-3 border-b last:border-b-0 cursor-pointer transition-colors duration-200 hover:bg-gray-100 p-2"
              >
                <Text size="3" weight="medium" className="mb-1">
                  {subCourse.name}
                </Text>
                <Flex gap="2" className="text-gray-500">
                  <Text size="2">{subCourse.duration}</Text>
                  <Text size="2">&bull;</Text>
                  <Text size="2">
                    {subCourse.quizzes}
                    {' '}
                    Quiz
                  </Text>
                </Flex>
              </Box>

              // <Flex
              //   key={subIndex}
              //   justify="between"
              //   align="center"
              //   className="py-3 border-b last:border-b-0"
              // >
              //   <Text size="3" weight="medium" className="truncate">
              //     {subCourse.name}
              //   </Text>
              //   <Flex gap="3" className="flex-shrink-0 text-gray-500">
              //     <Text size="2">{subCourse.duration}</Text>
              //     <Text size="2">{subCourse.quizzes} Quiz</Text>
              //   </Flex>
              // </Flex>
            ))}
          </Box>
        </Accordion.Content>
      </Box>
    </Accordion.Item>
  );
}

type MyCoursesProps = {
  courses: Course[];
};

function MyCourses({ courses }: MyCoursesProps) {
  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0 mb-4">
        {/* Ensure this text does not interfere with the scrollable area */}
        <Text size="6" weight="bold">
          My Courses
        </Text>
      </Box>
      <Box className="flex-grow overflow-y-auto pb-4">
        <Accordion.Root type="single" collapsible className="w-full">
          {courses.map((course, index) => (
            <CourseCard key={index} course={course} index={index} />
          ))}
        </Accordion.Root>
      </Box>
    </Flex>
  );
}

export default MyCourses;
