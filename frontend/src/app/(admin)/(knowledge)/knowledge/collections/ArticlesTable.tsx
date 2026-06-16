import React, { useState } from "react";
import {
  Text,
  Table,
  Flex,
  Badge,
  Box,
  Avatar,
} from "@radix-ui/themes";
import { FileIcon } from "@radix-ui/react-icons";

interface TableProps {
  isLoading: boolean;
  error: string | null;
  kbArticles?: any[];
}

export function ArticlesTable({ isLoading, error, kbArticles }: TableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "created_at",
    direction: "desc",
  });

  // Sort function
  const sortedArticles = React.useMemo(
    () =>
      [...kbArticles].sort((a, b) => {
        if (sortConfig.key === "collection_name") {
          if (a.collection_name < b.collection_name) {
            return sortConfig.direction === "asc" ? -1 : 1;
          }
          if (a.collection_name > b.collection_name) {
            return sortConfig.direction === "asc" ? 1 : -1;
          }
          return 0;
        }

        if (sortConfig.key === "created_at") {
          return sortConfig.direction === "asc"
            ? new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            : new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime();
        }

        return 0;
      }),
    [kbArticles, sortConfig]
  );

  // Sort handler
  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  if (isLoading) return <Text>Loading KB articles...</Text>;
  if (error) return <Text color="red">{error}</Text>;

  const handleArticleClick = (accessUrl) => {
    window.open(accessUrl, "_blank");
  };

  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            onClick={() => requestSort("collection_name")}
            style={{ cursor: "pointer" }}
          >
            Collection{" "}
            {sortConfig.key === "collection_name" &&
              (sortConfig.direction === "asc" ? "↑" : "↓")}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            onClick={() => requestSort("created_at")}
            style={{ cursor: "pointer" }}
          >
            Uploaded At{" "}
            {sortConfig.key === "created_at" &&
              (sortConfig.direction === "asc" ? "↑" : "↓")}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {sortedArticles.map((article) => (
          <Table.Row key={article.id}>
            <Table.Cell>
              <Flex align="center" gap="2" style={{ minHeight: "40px" }}>
                <Avatar
                  size="2"
                  variant="solid"
                  fallback={<FileIcon />}
                  radius="medium"
                />
                <Flex direction="column" justify="center">
                  <Text
                    title={article.name}
                    style={{
                      cursor: "pointer",
                    }}
                    className="hover:text-blue-600 hover:underline"
                    onClick={() => handleArticleClick(article.url)}
                  >
                    {article.name}
                  </Text>
                </Flex>
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Box
                display="inline"
                style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
              >
                <Box
                  style={{
                    background: "#f3f4f6",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "13px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#6b7280",
                    }}
                  />
                  <Text size="2">{article.collection_name}</Text>
                </Box>
              </Box>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" style={{ minHeight: "40px" }}>
                {new Date(article.created_at).toLocaleDateString()}
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Badge
                color={
                  article.status === "processed"
                    ? "green"
                    : article.status === "failed"
                    ? "red"
                    : "blue"
                }
              >
                {article.status === "processed"
                  ? "Completed"
                  : article.status === "failed"
                  ? "Failed"
                  : "Processing"}
              </Badge>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
