import { useGlobalContext } from "contexts/store";

interface IRoles {
    agent_assist_admin: boolean;
    agent_assist_user: boolean;
    train_assist_admin: boolean;
    train_assist_user: boolean;
    platform_admin: boolean;
    knowledge_assist_admin: boolean;
    knowledge_assist_user: boolean;
    chat_virtual_agent_admin: boolean;
    chat_virtual_agent_user: boolean;
    voice_virtual_agent_admin: boolean;
    voice_virtual_agent_user: boolean;
    voice_copilot_admin: boolean;
    voice_copilot_user: boolean;
    is_tag_lead: boolean;
}

const useUserRoles = () => {
    const NEXT_PUBLIC_USE_LEGACY_ROLES = process.env.NEXT_PUBLIC_USE_LEGACY_ROLES === "true";

    const { assignedRoles, user } = useGlobalContext();
    const legacyRole = user?.role;
    const isLegacyUser = (legacyRole === "Agent" || legacyRole === "Trainer" || legacyRole === "User") && NEXT_PUBLIC_USE_LEGACY_ROLES;

    const agent_assist_admin = assignedRoles.includes("agent_assist_admin");
    const agent_assist_user = assignedRoles.includes("agent_assist_user") || isLegacyUser;
    const train_assist_admin = assignedRoles.includes("train_assist_admin");
    const train_assist_user = assignedRoles.includes("train_assist_user") || isLegacyUser;
    const knowledge_assist_admin = assignedRoles.includes("knowledge_assist_admin");
    const knowledge_assist_user = assignedRoles.includes("knowledge_assist_user") || isLegacyUser;
    const platform_admin = assignedRoles.includes("platform_admin") || legacyRole === "Admin";
    const chat_virtual_agent_admin = assignedRoles.includes("chat_virtual_agent_admin");
    const chat_virtual_agent_user = assignedRoles.includes("chat_virtual_agent_user") || isLegacyUser;
    const voice_virtual_agent_admin = assignedRoles.includes("voice_virtual_agent_admin");
    const voice_virtual_agent_user = assignedRoles.includes("voice_virtual_agent_user") || isLegacyUser;
    const voice_copilot_admin = assignedRoles.includes("voice_copilot_admin");
    const voice_copilot_user = assignedRoles.includes("voice_copilot_user") || isLegacyUser;

    const is_tag_lead = !!user?.tag_lead?.length;

    const roles: IRoles = {
        agent_assist_admin: agent_assist_admin || platform_admin,
        agent_assist_user: agent_assist_user || agent_assist_admin || platform_admin,
        train_assist_admin: train_assist_admin || platform_admin,
        train_assist_user: train_assist_user || train_assist_admin || platform_admin || is_tag_lead,
        knowledge_assist_admin: knowledge_assist_admin || platform_admin,
        knowledge_assist_user: knowledge_assist_user || knowledge_assist_admin || platform_admin,
        platform_admin: platform_admin,
        chat_virtual_agent_admin: chat_virtual_agent_admin || platform_admin,
        chat_virtual_agent_user: chat_virtual_agent_user || chat_virtual_agent_admin || platform_admin,
        voice_virtual_agent_admin: voice_virtual_agent_admin || platform_admin,
        voice_virtual_agent_user: voice_virtual_agent_user || voice_virtual_agent_admin || platform_admin,
        voice_copilot_admin: voice_copilot_admin || platform_admin,
        voice_copilot_user: voice_copilot_user || voice_copilot_admin || platform_admin,
        is_tag_lead: is_tag_lead,
    };

    return roles;
};

export default useUserRoles;
