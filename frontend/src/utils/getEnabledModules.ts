import { ModuleKey } from "constants/global";
import { ModuleConfig } from "constants/global";

// Extract enabled modules from the module configuration
export function getEnabledModules(modules: ModuleConfig): ModuleKey[] {
    return Object.entries(modules)
      .filter(([, config]) => config?.enabled)
      .map(([key]) => key as ModuleKey);
}