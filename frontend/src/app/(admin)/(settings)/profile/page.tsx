"use client";

import React, { useState } from "react";
import withAuth from "components/withAuth";
import Spinner from "components/spinner/spinner";
import Banner from "components/profile/Profile";
import Information from "components/profile/Info";
import Password from "components/profile/Password";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Flex, Box, Text, Grid } from "@radix-ui/themes";
import { useTranslation } from 'react-i18next';

function ProfileSetting() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  if (loading) {
    return <Spinner />;
  }

  return (
    <Flex direction="column" style={{ height: "100%", width: "100%" }}>
      <Box style={{ flexShrink: 0 }}>
        <Flex
          align="center"
          justify="between"
          style={{
            height: "56px",
            borderBottom: "1px solid var(--gray-8)",
            padding: "0 16px",
          }}
        >
          <Text size="4" weight="medium">
            {t('profile.profile')}
          </Text>
        </Flex>
      </Box>
      <Box
        style={{
          flexGrow: 1,
          overflow: "auto",
          width: "100%",
          padding: "12px",
        }}
      >
        <Grid columns={{ initial: "1", md: "2" }} gap="4" width="100%">
          <Box>
            <Banner setLoading={setLoading} />
            <Box mt="4">
              <Information setLoading={setLoading} />
            </Box>
          </Box>
          <Box>
            <Password />
          </Box>
        </Grid>
      </Box>
      <ToastContainer />
    </Flex>
  );
}

export default withAuth(ProfileSetting);
