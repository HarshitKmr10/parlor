import React, { forwardRef } from "react";
import { UseFormRegister } from "react-hook-form";
import { Box } from "@radix-ui/themes";
import { Search } from "lucide-react";

interface FormValues {
  search: string;
}

interface SearchBarProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  register: UseFormRegister<FormValues>;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ register, ...inputProps }, ref) => {
    return (
      <Box className="relative">
        <Search size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
        <input
          ref={ref}
          {...register("search")}
          {...inputProps}
          className="w-full pl-8 pr-4 py-1.5 border text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Box>
    );
  }
);

SearchBar.displayName = "SearchBar";

export default SearchBar;
