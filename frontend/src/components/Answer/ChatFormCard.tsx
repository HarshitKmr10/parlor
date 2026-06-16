import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Flex, Text, Button } from "@radix-ui/themes";
import InputField from "components/fields/InputField";
import { Loader2 } from 'lucide-react';
import { SelectorWithSearch } from "components/fields/SelectorWithSearch";
import { ChatFormField } from "api/chat/models";
import clsx from "clsx";

type ChatFormCardProps = {
  formFields: ChatFormField[];
  onSubmit: (formState: Record<string, string>) => Promise<void>;
}

export const ChatFormCard = ({ formFields, onSubmit }: ChatFormCardProps) => {

    const [formState, setFormState] = useState<Record<string, string>>({});
    const [isFormValid, setIsFormValid] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
  
    // Initialize formState with default values from formFields
    useEffect(() => {
        const initialState: Record<string, string> = {};
        formFields.forEach((field: any) => {
            if (field.default_value) {
                initialState[field.field_name] = field.default_value;
            }
        });
        
        if (Object.keys(initialState).length > 0) {
            setFormState(prevState => ({
                ...prevState,
                ...initialState
            }));
        }
    }, [formFields]);

    const handleFormSubmit = useCallback(() => {
        setIsLoading(true);
        const hiddenFields = formFields.filter((field: any) => !field.visible);
        onSubmit({
            ...formState,
            // Add hidden fields to formState
            ...hiddenFields.reduce((acc: Record<string, string>, field: any) => ({
                ...acc,
                [field.field_name]: field.value,
            }), {}),
        }).finally(() => {
            setIsLoading(false);
        });
    }, [formState, onSubmit]);

    const visibleFormFields = useMemo(() => formFields.filter((field: any) => field.visible) ?? [], [formFields]);

    useEffect(() => {
        // "u_best___email_to_reach" is optional field
        setIsFormValid(visibleFormFields.every((field: any) => field?.field_name === 'u_best___email_to_reach' ? (formState?.['u_preferred_contact_method'] === 'Phone' ? formState?.[field.field_name] : true) : formState?.[field.field_name]));
    }, [formState, visibleFormFields]);


    return (
        <Flex direction="column" gap="2" className="mt-2 w-1/2">
            <Text color="gray" size="3" weight="bold">📝 Please fill the mandatory fields to create the ticket</Text>
            {visibleFormFields?.map((field: any) => (
                <React.Fragment key={field.field_name}>
                    {field.type === "dropdown" ? (
                        <SelectorWithSearch
                            key={field.field_name}
                            label={field.display_name}
                            itemValueKey={field.dropdown_key}
                            itemNameKey="name"
                            contentWidth="457px"
                            selectedItemValue={formState?.[field.field_name] ?? field.default_value ?? ""}
                            onChange={(value) => {
                                setFormState({ ...formState, [field.field_name]: value });
                            }}
                            required={true}
                            items={field.value}
                        />
                    ) : (
                        <InputField
                            key={field.field_name}
                            label={field.display_name}
                            name={field.field_name}
                            required={true}
                            extra={clsx('py-0', field.field_name === "u_best___email_to_reach" ? formState?.['u_preferred_contact_method'] === 'Phone' ? "block" : "hidden" : undefined)}
                            size="2"
                            inputClassName="rounded-[8px] h-[40px]"
                            type={field.type as "text" | "hidden" | "tel" | "url" | "email" | "date" | "datetime-local" | "month" | "password" | "week"}
                            value={formState?.[field.field_name] ?? ""}
                            onChange={(e) => {
                                setFormState({
                                    ...formState,
                                    [field.field_name]: e.target.value?.trimStart()
                                });
                            }}
                            id={field.field_name}
                            placeholder={`Enter ${field.display_name}`}
                        />
                    )}
                </React.Fragment>
            ))}
            <Button className="my-2 cursor-pointer" radius="medium" onClick={handleFormSubmit} disabled={!isFormValid || isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </Button>
        </Flex>
    );
};
