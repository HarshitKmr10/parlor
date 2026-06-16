"use client";

import InputField from "components/fields/InputField";
import TextField from "components/fields/TextField";
import { Flex } from "@radix-ui/themes";
import { FormData, useAppCreator } from "../AppCreatorProvider";

export function BasicInfoStep() {
  const { formData, updateFormData } = useAppCreator();

  const handleChange = (field: string, value: string) => {
    updateFormData((prevData: FormData) => ({ 
      ...prevData,
      basic: {
        ...prevData.basic,
        [field]: value,
      },
    }));
  };

  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="4">
        <InputField
          id="name"
          label="Application Name (Required)"
          placeholder="e.g. 'AI Service Desk Assistant'"
          value={formData.basic.name}
          onChange={(e) => handleChange("name", e.target.value)}
        />  

        <TextField
          id="description"
          label="Description (Optional)"
          placeholder="Briefly describe the application's purpose"
          value={formData.basic.description}
          onChange={(e) => handleChange("description", e.target.value)}
        />
      </Flex>
    </Flex>
  );
}

