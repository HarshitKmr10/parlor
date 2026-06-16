import React, { useState, useEffect } from "react";
import { Box, Text, Table, Flex, Button, Badge } from "@radix-ui/themes";
import { toast } from "react-toastify";

interface UserRequest {
  timestamp: string;
  orgId: string;
  orgName: string;
  fullName: string;
  email: string;
  password: string;
  comment: string;
  status: string;
}

function UserRequestsTable() {
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/organization-user-request');
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      } else {
        toast.error('Failed to fetch user requests');
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to fetch user requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleStatusUpdate = async (email: string, newStatus: string) => {
    try {
      // In a real implementation, you'd update the CSV file or database
      // For now, we'll just update the local state
      setRequests(prev => 
        prev.map(req => 
          req.email === email ? { ...req, status: newStatus } : req
        )
      );
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return <Badge color="orange">Pending</Badge>;
      case 'approved':
        return <Badge color="green">Approved</Badge>;
      case 'rejected':
        return <Badge color="red">Rejected</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Box className="p-4">
        <Text>Loading user requests...</Text>
      </Box>
    );
  }

  if (requests.length === 0) {
    return (
      <Box className="p-4">
        <Text>No user requests found.</Text>
      </Box>
    );
  }

  return (
    <Box className="p-4">
      <Flex justify="between" align="center" mb="4">
        <Text size="5" weight="bold">
          Pending User Requests
        </Text>
        <Button onClick={fetchRequests} variant="soft">
          Refresh
        </Button>
      </Flex>

      <Box className="overflow-x-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Organization</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Comments</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {requests.map((request, index) => (
              <Table.Row key={index}>
                <Table.Cell>
                  <Text size="2">{formatDate(request.timestamp)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="medium">{request.orgName}</Text>
                  <Text size="1" color="gray">{request.orgId}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{request.fullName}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{request.email}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" className="max-w-xs truncate">
                    {request.comment || '-'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {getStatusBadge(request.status)}
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    {request.status === 'pending_verification' && (
                      <>
                        <Button
                          size="1"
                          color="green"
                          onClick={() => handleStatusUpdate(request.email, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="1"
                          color="red"
                          onClick={() => handleStatusUpdate(request.email, 'rejected')}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}

export default UserRequestsTable;
