// UserOverview.tsx

"use client";

import React, { useEffect, useState } from "react";
import { useGlobalContext } from "contexts/store";
import Spinner from "components/spinner/spinner";
import UsersOverview from "components/users/users-overview/SearchTableUsersOverivew";
import withAuth from "components/withAuth";
import { Flex, Box, Text, Dialog, Button } from "@radix-ui/themes";
import UserInfo from "components/users/new-user/UserInfo";
import { User } from "api/user";
import { useTranslation } from 'react-i18next';
import RolesDisplay, { AssignedRole } from "components/users/RolesDisplay";

type RowObj = {
  name: string[];
  email: string;
  date: string;
  teams: string[];
  role: string;
  id: string;
  platform: any[];
  assigned_roles: AssignedRole[];
};


function AgentsList() {
  const { t } = useTranslation();
  const { selectedTeam, user } = useGlobalContext();
  const [tableData, setTableData] = useState<RowObj[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [open, setOpen] = useState(false);

  const transformUserData = (apiData) =>
    apiData.map((u) => ({
      name: [u.name, u.profile_pic],
      email: u.email,
      date: new Date(u.created_at).toLocaleDateString("en-US"),
      teams: u.teams,
      role: u.role === "User" ? "Agent" : u.role,
      id: u.id,
      platform: [],
      assigned_roles: u.assigned_roles || [],
    }));

  const fetchUserDetails = async () => {
    try {
      setIsLoading(true);
      const data = await User.GetAllUsers(user.org_id, selectedTeam?.id, user);
      const transformedData = transformUserData(data);
      setTableData(transformedData);
    } catch (error) {
      setError(error);
      console.error(`Error fetching data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const refreshUserData = () => {
    fetchUserDetails();
    setOpen(false);
  };

  if (isLoading || isLoadingUser) return <Spinner />;
  if (error) {
    return (
      <div>
        Error: {error?.message}
      </div>
    );
  }

  const filteredTableData = tableData.filter(
    (row) =>
      row.name[0].toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.assigned_roles.some(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Flex direction="column" className="h-full">
      <Box className="flex-shrink-0 sticky top-[40px] bg-white z-10">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)]"
          px="4"
        >
          <Text size="4" weight="medium">
            {t('admin_panel.usersOnThisPlatform')}
          </Text>
          <Flex align="center">
            <input
              type="text"
              placeholder={t('admin_panel.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "4px 8px",
                height: "30px",
                borderRadius: "4px",
                border: "1px solid var(--gray-8)",
                marginRight: "8px",
                fontSize: "14px",
              }}
            />

            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger onClick={() => setOpen(true)}>
                <Button size="1" ml="2" className="cursor-pointer">
                  {t('admin_panel.addUser')}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <UserInfo
                  setIsLoading={setIsLoadingUser}
                  refreshUserData={refreshUserData}
                  onClose={() => setOpen(false)}
                />
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
        </Flex>
      </Box>
      <Flex className="flex-grow overflow-hidden w-full">
        <UsersOverview
          tableData={filteredTableData}
          refreshUserData={refreshUserData}
          columns={[
            { header: t('admin_panel.name'), accessor: "name" },
            { header: t('admin_panel.email'), accessor: "email" },
            {
              header: t('admin_panel.roles'),
              accessor: "assigned_roles",
              cell: (roles) => <RolesDisplay roles={roles} />,
            },
            { header: t('admin_panel.createdAt'), accessor: "date" },
          ]}
        />
      </Flex>
    </Flex>
  );
}

export default withAuth(AgentsList);
