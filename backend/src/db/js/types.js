'use strict';

/**
 * @typedef {Object} MeetingJoinerRow
 * @property {string} id
 * @property {string} meeting_url
 * @property {string|null} normalized_meeting_url
 * @property {'not_joined'|'ongoing'|'completed'} status
 * @property {string|null} video_link
 * @property {object|null} transcript
 * @property {object|null} participants
 * @property {string|null} org_id
 * @property {string|null} meeting_id
 * @property {Date|null} bot_join_time
 * @property {Date|null} bot_leave_time
 * @property {string|null} bot_name
 * @property {string|null} transcript_source
 * @property {string|null} exit_reason
 * @property {object|null} exit_details
 * @property {string|null} pod_name
 * @property {string|null} cluster_name
 * @property {Date|null} last_heartbeat_at
 * @property {string|null} original_meeting_id
 * @property {boolean} is_duplicate
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * Narrow surface every adapter must implement. Mirrors the actual call
 * sites in meetingJoinerService.js — no general-purpose ORM here.
 *
 * @typedef {Object} MeetingJoinerStore
 * @property {(normalizedUrl: string, orgId: string|null) => Promise<MeetingJoinerRow|null>} findExistingOngoing
 * @property {(data: object) => Promise<MeetingJoinerRow>} createMeetingJoiner
 * @property {(id: string) => Promise<MeetingJoinerRow & {org?:object,meeting?:object,original_meeting?:MeetingJoinerRow,duplicates?:MeetingJoinerRow[]}|null>} findUniqueWithRelations
 * @property {(id: string) => Promise<MeetingJoinerRow|null>} findUniqueBasic
 * @property {(orgId: string, status: string|null) => Promise<MeetingJoinerRow[]>} findManyByOrg
 * @property {() => Promise<MeetingJoinerRow[]>} findActive
 * @property {(originalId: string) => Promise<MeetingJoinerRow[]>} findActiveDuplicatesOf
 * @property {(id: string, status: string, extras?: object) => Promise<MeetingJoinerRow>} updateStatusAndTimestamps
 * @property {(id: string, fields: object) => Promise<MeetingJoinerRow>} updateFields
 * @property {(id: string, transcript: object) => Promise<MeetingJoinerRow>} updateTranscript
 * @property {(id: string, participants: any[]) => Promise<MeetingJoinerRow>} updateParticipants
 * @property {(originalId: string, participants: any[]) => Promise<void>} updateManyDuplicateParticipants
 * @property {(id: string, link: string) => Promise<MeetingJoinerRow>} setVideoLink
 * @property {() => Promise<void>} disconnect
 */

module.exports = {};
