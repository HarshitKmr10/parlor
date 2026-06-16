"use client";

import React from "react";
import { Box, Text, Flex, Tooltip, IconButton } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface DuplicateArticlesChartProps {
  categories: string[];
  counts: number[];
}

export function DuplicateArticlesChart({
  categories,
  counts,
}: DuplicateArticlesChartProps) {
  // Generate colors based on the iris accent color scheme
  const generateColors = (count: number) => {
    const chartColors = [
      "#272962",
      "#5753C6",
      "#5151CD",
      "#5B5BD6",
      "#9B9EF0",
      "#B8BAF8",
      "#CBCDFF",
      "#CBCDFF",
      "#E6E7FF",
      "#F0F1FE",
      "#F8F8FF",
      "#FDFDFF",
    ];
    return Array.from(
      { length: count },
      (_, i) => chartColors[i % chartColors.length]
    );
  };

  const colors = generateColors(categories.length);

  return (
    <Box className="w-full p-4 bg-white rounded-lg">
      <Flex align="center" gap="2" mb="4">
        <Text size="5" weight="medium" color="gray">
          Duplicate articles by category
        </Text>
        <Tooltip content="Number of duplicate articles per category">
          <IconButton size="1" variant="ghost">
            <InfoCircledIcon />
          </IconButton>
        </Tooltip>
      </Flex>
      <Plot
        // @ts-ignore
        data={[
          {
            x: categories,
            y: counts,
            type: "bar",
            marker: {
              color: colors,
            },
          },
        ]}
        layout={{
          autosize: true,
          margin: {
            t: 20,
            b: 60, // Increased bottom margin
            l: 40,
            r: 10,
          },
          height: 300, // Slightly increased height
          xaxis: {
            title: { text: "Category" },
            tickangle: -45, // Rotate labels
            automargin: true, // Automatically adjust margins
          },
          yaxis: { title: { text: "Count" } },
        }}
        useResizeHandler
        style={{ width: "100%", height: "100%", marginTop: "10px" }}
      />
    </Box>
  );
}
