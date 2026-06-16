"use client";

import React, { useState } from "react";
import {
  Box,
  Text,
  Flex,
  Tooltip,
  IconButton,
  RadioGroup,
} from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ModuleCompletionDataPoint {
  category: string;
  quizzesSolved: number;
  incidentsSolved: number;
}

interface ModuleCompletionChartProps {
  data: ModuleCompletionDataPoint[];
}

function ModuleCompletionChart({ data }: ModuleCompletionChartProps) {
  const [viewMode, setViewMode] = useState("combined");

  const categories = data.map((d) => d.category);
  const quizzesSolved = data.map((d) => d.quizzesSolved);
  const incidentsSolved = data.map((d) => d.incidentsSolved);

  const getChartData = () => {
    switch (viewMode) {
      case "modules":
        return [
          {
            y: quizzesSolved,
            x: categories,
            name: "Quizzes Solved",
            type: "bar",
            marker: {
              color: "#7B61FF",
              line: { width: 1, color: "#fff" },
              borderRadius: 5, // Rounded corners
            },
          },
        ];
      case "quizPerf":
        return [
          {
            y: quizzesSolved,
            x: categories,
            name: "Quizzes Solved",
            type: "bar",
            marker: {
              color: "#7B61FF",
              line: { width: 1, color: "#fff" },
              borderRadius: 5, // Rounded corners
            },
          },
        ];
      case "incidentPerf":
        return [
          {
            y: incidentsSolved,
            x: categories,
            name: "Virtual Incidents Solved",
            type: "bar",
            marker: {
              color: "#A0A0A0",
              line: { width: 1, color: "#fff" },
              borderRadius: 5, // Rounded corners
            },
          },
        ];
      default:
        return [
          {
            y: quizzesSolved,
            x: categories,
            name: "Quizzes Solved",
            type: "bar",
            marker: {
              color: "#7B61FF",
              line: { width: 1, color: "#fff" },
              borderRadius: 5, // Rounded corners
            },
          },
          {
            y: incidentsSolved,
            x: categories,
            name: "Virtual Incidents Solved",
            type: "bar",
            marker: {
              color: "#A0A0A0",
              line: { width: 1, color: "#fff" },
              borderRadius: 5, // Rounded corners
            },
          },
        ];
    }
  };

  return (
    <Box className="w-full bg-white p-4 rounded-lg shadow-sm">
      <Flex align="center" justify="between" mb="4">
        <Flex align="center" gap="2">
          <Text size="5" weight="bold">
            Module Completion Status:
          </Text>
          {/* <Sparkle color="violet" /> */}
        </Flex>
        <Tooltip content="View different aspects of module completion">
          <IconButton size="1" variant="ghost">
            <InfoCircledIcon />
          </IconButton>
        </Tooltip>
      </Flex>

      <RadioGroup.Root value={viewMode} onValueChange={setViewMode}>
        <Flex gap="3">
          <RadioGroup.Item value="combined">Combined</RadioGroup.Item>
          <RadioGroup.Item value="modules">Modules</RadioGroup.Item>
          <RadioGroup.Item value="quizPerf">Quiz Perf.</RadioGroup.Item>
          <RadioGroup.Item value="incidentPerf">
            <Flex align="center" gap="1">
              {/* <Sparkle color="violet" /> */}
              <Text>Incident Perf.</Text>
            </Flex>
          </RadioGroup.Item>
        </Flex>
      </RadioGroup.Root>

      <Plot
        // @ts-ignore
        data={getChartData()}
        layout={{
          barmode: "group",
          bargap: 0.2, // Add space between bars
          xaxis: {
            title: { text: "" },
            tickvals: [0, 1, 2, 3],
            ticktext: categories,
            fixedrange: true,
          },
          yaxis: {
            title: { text: "" },
            range: [0, 100],
            ticksuffix: "%",
            fixedrange: true,
          },
          legend: { orientation: "h", y: 1.1 },
          margin: {
            t: 10,
            r: 10,
            b: 50,
            l: 40,
          },
          height: 300,
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "100%" }}
      />
    </Box>
  );
}

export default ModuleCompletionChart;
