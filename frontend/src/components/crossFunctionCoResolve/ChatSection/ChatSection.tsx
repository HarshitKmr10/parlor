'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Flex, Box } from '@radix-ui/themes';
import { ExampleList } from 'components/Example';
import QuestionAndAnswer from 'components/QuestionAndAnswer/QuestionAndAnswer';
import { QuestionInput } from 'components/QuestionInput';
import PDFModal from 'components/Modals/PDFModal';
import { useGlobalContext } from 'contexts/store';
import { IncidentCluster } from 'app/(admin)/cross-functional-coresolve/incidentClusters.full';
import { ExpertChatApi } from 'services/ExpertCopilot/api';

interface ChatSectionProps {
  selectedItem: IncidentCluster | null;
  answers: [string, any][];
  setAnswers: React.Dispatch<React.SetStateAction<[string, any][]>>;
}

const ChatSection = ({ selectedItem, answers, setAnswers }: ChatSectionProps) => {
  const { user, organization } = useGlobalContext();
  const lastQuestionRef = useRef<string>('');
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>();
  const [showCitation, setShowCitation] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<string>();

  // Define assistantReply at the top-level of the component so it is available everywhere
  const assistantReply1 = {
    id: 'chatcmpl-BwCK4qaWpU8dCCCh1ThS3IiwgpRSz',
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        logprobs: null,
        message: {
          content: `<b>Priority 1 Ticket Created</b><br>\n<b>Ticket ID:</b> <a href="https://app.aiopshq.xyz/nav_to.do?uri=problem.do?sys_id=PRB0000567" target="_blank" style="color: var(--blue-9); text-decoration: underline;">PRB0000567</a><br>\n<b>Title:</b> High API Latency Due to Database Performance Issues<br>\n<b>Description:</b> ${selectedItem['Short description']} <br>\n<b>Priority:</b> P1 (Critical)<br>\n<b>Assigned To:</b> L2 Group<br>\n<b>Category:</b> ${selectedItem['Category']}<br>\n<b>Created On:</b> ${new Date().toISOString().split('T')[0]}<br>\nLet me know if you need any additional details or updates to the ticket!`,
          refusal: null,
          role: 'assistant',
          audio: null,
          function_call: null,
          tool_calls: null,
          annotations: [],
        },
        content_filter_results: {
          hate: { filtered: false, severity: 'safe' },
          self_harm: { filtered: false, severity: 'safe' },
          sexual: { filtered: false, severity: 'safe' },
          violence: { filtered: false, severity: 'safe' },
        },
        context: {
          data_points: null,
          thoughts: [
            {
              title: 'Primary Cache',
              description: {
                user_id: null,
                user_id_check_failed: false,
                ticket_data: {
                  action_type: '',
                  ticket_id: '',
                  ticket_subject: '',
                  ticket_description: '',
                  ticket_urgency: '',
                  ticket_impact: '',
                },
                ticket_confirmation_data: {
                  ticket_action_requested: false,
                  ticket_details_observed: false,
                  ticket_action_confirmed: false,
                },
                issues_resolved: [],
                issues_unresolved: [],
                optimized_questions_so_far: [],
              },
              props: null,
            },
            { title: 'Original user query', description: 'Create a p1 ticket for me', props: null },
            {
              title: 'Prompt',
              description: [
                "{'role': 'system', 'content': \"You are an AI Chatbot assisting Expert Engineers (L2, L3 engineers) in their apps, infra, network, cloud operations related queries. You are interactive with the Expert Engineers. One conversation is provided below. The user will ask a question and you have to reply with the right response based on the script. The reply should be a good looking plain HTML and not HTML code block.\\n\\n---------------------------------------------------------------\\n### Conversation 1: API Latency Due to Slow Database Queries\\n\\n>>> Human Agent: Hey. Can you help me with this issue? We're seeing high API latency and I think it might be database-related.\\n\\n>>> Chatbot: Sure, I'd be happy to help. It looks like slow queries are causing the API latency. Would you like me to check the execution plan of the slow queries for you?\\n\\n>>> Human Agent: Yes, please run EXPLAIN ANALYZE on these queries.\\n\\n>>> Chatbot: Here are the results of EXPLAIN ANALYZE with highlighted full table scans and inefficient joins:\\n\\n```sql\\nEXPLAIN ANALYZE SELECT * FROM users WHERE last_login > '2023-01-01';\\n                                                 QUERY PLAN\\n------------------------------------------------------------------------------------------------------------\\n Seq Scan on users  (cost=0.00..1638.00 rows=50000 width=90) (actual time=0.019..8.514 rows=49876 loops=1)\\n   Filter: (last_login > '2023-01-01'::date)\\n   Rows Removed by Filter: 124\\n Planning Time: 0.088 ms\\n Execution Time: 11.905 ms\\n(5 rows)\\n\\nEXPLAIN ANALYZE SELECT o.*, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.status = 'pending';\\n                                                    QUERY PLAN\\n------------------------------------------------------------------------------------------------------------------\\n Hash Join  (cost=33.78..3017.78 rows=1000 width=122) (actual time=0.308..15.962 rows=987 loops=1)\\n   Hash Cond: (o.user_id = u.id)\\n   ->  Seq Scan on orders o  (cost=0.00..2793.00 rows=1000 width=92) (actual time=0.012..10.325 rows=987 loops=1)\\n         Filter: (status = 'pending'::order_status)\\n         Rows Removed by Filter: 9013\\n   ->  Hash  (cost=22.00..22.00 rows=940 width=36) (actual time=0.247..0.248 rows=940 loops=1)\\n         Buckets: 1024  Batches: 1  Memory Usage: 54kB\\n         ->  Seq Scan on users u  (cost=0.00..22.00 rows=940 width=36) (actual time=0.006..0.145 rows=940 loops=1)\\n Planning Time: 0.262 ms\\n Execution Time: 16.112 ms\\n(10 rows)\\n```\\n\\nThese results show full table scans on both the users and orders tables, which can be inefficient for large datasets.\\n\\n>>> Human Agent: Can you check for table locks or deadlocks and verify index usage on frequently accessed columns?\\n\\n>>> Chatbot: Sure. Checking for locks, deadlocks, and index usage now.\\n\\nLocks:\\n\\n```sql\\nSELECT * FROM pg_locks WHERE NOT granted;\\n locktype | database | relation | page | tuple | virtualxid | transactionid | classid | objid | objsubid | virtualtransaction | pid | mode | granted | fastpath\\n----------+----------+----------+------+-------+------------+---------------+---------+-------+----------+--------------------+-----+------+---------+----------\\n(0 rows)\\n```\\n\\nNo locks detected at the moment.\\n\\nDeadlocks:\\n\\n```sql\\nSELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';\\n datid | datname | pid | usesysid | usename | application_name | client_addr | client_hostname | client_port | backend_start | xact_start | query_start | state_change | wait_event_type | wait_event | state | backend_xid | backend_xmin | query | backend_type\\n-------+---------+-----+----------+---------+------------------+-------------+-----------------+-------------+---------------+------------+-------------+--------------+-----------------+------------+-------+-------------+--------------+-------+--------------\\n(0 rows)\\n```\\n\\nNo deadlocks detected.\\n\\nIndex usage:\\n\\n```sql\\nSELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch\\nFROM pg_stat_user_indexes\\nWHERE schemaname = 'public'\\nORDER BY idx_scan DESC\\nLIMIT 5;\\n schemaname |  relname   | indexrelname  | idx_scan | idx_tup_read | idx_tup_fetch\\n------------+------------+---------------+----------+--------------+---------------\\n public     | users      | users_pkey    |    98765 |       98765  |        98765\\n public     | orders     | orders_pkey   |    87654 |       87654  |        87654\\n public     | products   | products_pkey |    76543 |       76543  |        76543\\n public     | users      | users_email_idx|   65432 |       65432  |        65432\\n public     | orders     | orders_user_id_idx|54321 |       54321  |        54321\\n(5 rows)\\n```\\n\\nThis shows the top 5 most used indexes. The primary key indexes are being used frequently, but we might benefit from additional indexes on frequently queried columns.\\n\\n>>> Human Agent: The new analytics query is causing full table scans. Can you optimize it for me?\\n\\n>>> Chatbot: Adding indexes to the necessary columns and refactoring the query to use JOINs. Here's the optimized query:\\n\\n```sql\\n-- Before\\nSELECT * FROM orders WHERE user_id IN (SELECT user_id FROM users WHERE status = 'active');\\n\\n-- After\\nCREATE INDEX idx_users_status ON users(status);\\nCREATE INDEX idx_orders_user_id ON orders(user_id);\\n\\nSELECT o.*\\nFROM orders o\\nJOIN users u ON o.user_id = u.user_id\\nWHERE u.status = 'active';\\n```\\n\\nThis optimization adds indexes on the `status` column of the `users` table and the `user_id` column of the `orders` table. It also replaces the subquery with a JOIN, which is generally more efficient.\\n\\n>>> Human Agent: I've refactored the query. Let's monitor the performance now.\\n\\n>>> Chatbot: Sure. Let's see if the changes have improved the query execution.\\n\\nQUERY PLAN\\n```sql\\n------------------------------------------------------------------------------------------------------------------\\n Hash Join  (cost=29.78..2017.78 rows=1000 width=122) (actual time=0.208..10.962 rows=987 loops=1)\\n   Hash Cond: (o.user_id = u.user_id)\\n   ->  Seq Scan on orders o  (cost=0.00..1793.00 rows=1000 width=92) (actual time=0.012..7.325 rows=987 loops=1)\\n         Filter: (status = 'active'::order_status)\\n         Rows Removed by Filter: 9013\\n   ->  Hash  (cost=19.00..19.00 rows=940 width=36) (actual time=0.147..0.148 rows=940 loops=1)\\n         Buckets: 1024  Batches: 1  Memory Usage: 54kB\\n         ->  Seq Scan on users u  (cost=0.00..19.00 rows=940 width=36) (actual time=0.006..0.105 rows=940 loops=1)\\n Planning Time: 0.162 ms\\n Execution Time: 11.612 ms\\n(10 rows)\\n```\\n\\n>>> Human Agent: Confirmed! the query performance has improved. Can you check if there are any related alerts for this incident?\\n\\n>>> Chatbot: Sure, checking for related alerts now.\\n\\n alert_id | alert_type | alert_message                                  | timestamp\\n----------+------------+------------------------------------------------+---------------------\\n  12345   | DATABASE   | High latency detected on DB01                  | 2024-05-05 10:45:00\\n  12346   | NETWORK    | Load balancer NET01 experiencing high traffic  | 2024-05-05 10:50:00\\n  12347   | APPLICATION| API response time increased on APP01           | 2024-05-05 10:55:00\\n\\nThese alerts indicate high latency on DB01, high traffic on NET01, and increased API response time on APP01, which are likely related to the issue.\\n\\n>>> Human Agent: Thanks! This is very helpful.\\n\\n>>> Chatbot: You’re welcome! If you need any further assistance, feel free to ask. I'll update the incident with resolution details.\\n\"}",
                "{'content': '', 'tool_call_id': None, 'role': 'user', 'tool_calls': None}",
                "{'content': '<b>API Latency Due to Slow Database Queries</b><br>High API latency detected due to inefficient database queries. Optimization efforts include adding indexes, refactoring queries, and updating table statistics.\\n        \\n      NOC Virtual Agent (NVA) Summary:\\n  This Incident was processed by NVA and was assigned to this L2 resolver group:\\n  - Similar issues which have been resolved by this L2 resolver group.', 'tool_call_id': None, 'role': 'assistant', 'tool_calls': None}",
                "{'content': 'Create a p1 ticket for me', 'tool_call_id': None, 'role': 'user', 'tool_calls': None}",
              ],
              props: null,
            },
          ],
          followup_questions: null,
          citations: null,
          user: null,
        },
      },
    ],
    created: 1753210092,
    model: 'gpt-4o-2024-11-20',
    object: 'chat.completion',
    service_tier: null,
    system_fingerprint: 'fp_ee1d74bde0',
    usage: {
      completion_tokens: 172,
      prompt_tokens: 1967,
      total_tokens: 2139,
      completion_tokens_details: {
        accepted_prediction_tokens: 0,
        audio_tokens: 0,
        reasoning_tokens: 0,
        rejected_prediction_tokens: 0,
      },
      prompt_tokens_details: { audio_tokens: 0, cached_tokens: 0 },
    },
    prompt_filter_results: [
      {
        prompt_index: 0,
        content_filter_results: {
          hate: { filtered: false, severity: 'safe' },
          self_harm: { filtered: false, severity: 'safe' },
          sexual: { filtered: false, severity: 'safe' },
          violence: { filtered: false, severity: 'safe' },
        },
      },
    ],
  };

  const assistantReply2 = {
    id: 'chatcmpl-BwCK4qaWpU8dCCCh1ThS3IiwgpRSz',
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        logprobs: null,
        message: {
          content: `
  <b>Drafted Knowledge Base Article</b><br>
  <b>KB ID:</b> <a href="https://app.aiopshq.xyz/nav_to.do?uri=kb_article.do?sys_id=KB212345" target="_blank" style="color: var(--blue-9); text-decoration: underline;">KB212345</a><br>
  <b>Title:</b> Shift Review Steps<br>
  <b>Description:</b> Drafted as per your request for incident: ${selectedItem?.['Short description']}<br>
  <b>Category:</b> ${selectedItem?.['Category']}<br>
  <b>Created On:</b> ${new Date().toISOString().split('T')[0]}<br>
  Let me know if you’d like to update or publish this article.`,
          role: 'assistant',
          refusal: null,
          audio: null,
          function_call: null,
          tool_calls: null,
          annotations: [],
        },
        content_filter_results: {
          hate: { filtered: false, severity: 'safe' },
          self_harm: { filtered: false, severity: 'safe' },
          sexual: { filtered: false, severity: 'safe' },
          violence: { filtered: false, severity: 'safe' },
        },
        context: {
          data_points: null,
          thoughts: [
            {
              title: 'Primary Cache',
              description: {
                user_id: null,
                user_id_check_failed: false,
                ticket_data: {
                  action_type: '',
                  ticket_id: '',
                  ticket_subject: '',
                  ticket_description: '',
                  ticket_urgency: '',
                  ticket_impact: '',
                },
                ticket_confirmation_data: {
                  ticket_action_requested: false,
                  ticket_details_observed: false,
                  ticket_action_confirmed: false,
                },
                issues_resolved: [],
                issues_unresolved: [],
                optimized_questions_so_far: [],
              },
              props: null,
            },
            { title: 'Original user query', description: 'Create a p1 ticket for me', props: null },
            {
              title: 'Prompt',
              description: [
                "{'role': 'system', 'content': \"You are an AI Chatbot assisting Expert Engineers (L2, L3 engineers) in their apps, infra, network, cloud operations related queries. You are interactive with the Expert Engineers. One conversation is provided below. The user will ask a question and you have to reply with the right response based on the script. The reply should be a good looking plain HTML and not HTML code block.\\n\\n---------------------------------------------------------------\\n### Conversation 1: API Latency Due to Slow Database Queries\\n\\n>>> Human Agent: Hey. Can you help me with this issue? We're seeing high API latency and I think it might be database-related.\\n\\n>>> Chatbot: Sure, I'd be happy to help. It looks like slow queries are causing the API latency. Would you like me to check the execution plan of the slow queries for you?\\n\\n>>> Human Agent: Yes, please run EXPLAIN ANALYZE on these queries.\\n\\n>>> Chatbot: Here are the results of EXPLAIN ANALYZE with highlighted full table scans and inefficient joins:\\n\\n```sql\\nEXPLAIN ANALYZE SELECT * FROM users WHERE last_login > '2023-01-01';\\n                                                 QUERY PLAN\\n------------------------------------------------------------------------------------------------------------\\n Seq Scan on users  (cost=0.00..1638.00 rows=50000 width=90) (actual time=0.019..8.514 rows=49876 loops=1)\\n   Filter: (last_login > '2023-01-01'::date)\\n   Rows Removed by Filter: 124\\n Planning Time: 0.088 ms\\n Execution Time: 11.905 ms\\n(5 rows)\\n\\nEXPLAIN ANALYZE SELECT o.*, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.status = 'pending';\\n                                                    QUERY PLAN\\n------------------------------------------------------------------------------------------------------------------\\n Hash Join  (cost=33.78..3017.78 rows=1000 width=122) (actual time=0.308..15.962 rows=987 loops=1)\\n   Hash Cond: (o.user_id = u.id)\\n   ->  Seq Scan on orders o  (cost=0.00..2793.00 rows=1000 width=92) (actual time=0.012..10.325 rows=987 loops=1)\\n         Filter: (status = 'pending'::order_status)\\n         Rows Removed by Filter: 9013\\n   ->  Hash  (cost=22.00..22.00 rows=940 width=36) (actual time=0.247..0.248 rows=940 loops=1)\\n         Buckets: 1024  Batches: 1  Memory Usage: 54kB\\n         ->  Seq Scan on users u  (cost=0.00..22.00 rows=940 width=36) (actual time=0.006..0.145 rows=940 loops=1)\\n Planning Time: 0.262 ms\\n Execution Time: 16.112 ms\\n(10 rows)\\n```\\n\\nThese results show full table scans on both the users and orders tables, which can be inefficient for large datasets.\\n\\n>>> Human Agent: Can you check for table locks or deadlocks and verify index usage on frequently accessed columns?\\n\\n>>> Chatbot: Sure. Checking for locks, deadlocks, and index usage now.\\n\\nLocks:\\n\\n```sql\\nSELECT * FROM pg_locks WHERE NOT granted;\\n locktype | database | relation | page | tuple | virtualxid | transactionid | classid | objid | objsubid | virtualtransaction | pid | mode | granted | fastpath\\n----------+----------+----------+------+-------+------------+---------------+---------+-------+----------+--------------------+-----+------+---------+----------\\n(0 rows)\\n```\\n\\nNo locks detected at the moment.\\n\\nDeadlocks:\\n\\n```sql\\nSELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';\\n datid | datname | pid | usesysid | usename | application_name | client_addr | client_hostname | client_port | backend_start | xact_start | query_start | state_change | wait_event_type | wait_event | state | backend_xid | backend_xmin | query | backend_type\\n-------+---------+-----+----------+---------+------------------+-------------+-----------------+-------------+---------------+------------+-------------+--------------+-----------------+------------+-------+-------------+--------------+-------+--------------\\n(0 rows)\\n```\\n\\nNo deadlocks detected.\\n\\nIndex usage:\\n\\n```sql\\nSELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch\\nFROM pg_stat_user_indexes\\nWHERE schemaname = 'public'\\nORDER BY idx_scan DESC\\nLIMIT 5;\\n schemaname |  relname   | indexrelname  | idx_scan | idx_tup_read | idx_tup_fetch\\n------------+------------+---------------+----------+--------------+---------------\\n public     | users      | users_pkey    |    98765 |       98765  |        98765\\n public     | orders     | orders_pkey   |    87654 |       87654  |        87654\\n public     | products   | products_pkey |    76543 |       76543  |        76543\\n public     | users      | users_email_idx|   65432 |       65432  |        65432\\n public     | orders     | orders_user_id_idx|54321 |       54321  |        54321\\n(5 rows)\\n```\\n\\nThis shows the top 5 most used indexes. The primary key indexes are being used frequently, but we might benefit from additional indexes on frequently queried columns.\\n\\n>>> Human Agent: The new analytics query is causing full table scans. Can you optimize it for me?\\n\\n>>> Chatbot: Adding indexes to the necessary columns and refactoring the query to use JOINs. Here's the optimized query:\\n\\n```sql\\n-- Before\\nSELECT * FROM orders WHERE user_id IN (SELECT user_id FROM users WHERE status = 'active');\\n\\n-- After\\nCREATE INDEX idx_users_status ON users(status);\\nCREATE INDEX idx_orders_user_id ON orders(user_id);\\n\\nSELECT o.*\\nFROM orders o\\nJOIN users u ON o.user_id = u.user_id\\nWHERE u.status = 'active';\\n```\\n\\nThis optimization adds indexes on the `status` column of the `users` table and the `user_id` column of the `orders` table. It also replaces the subquery with a JOIN, which is generally more efficient.\\n\\n>>> Human Agent: I've refactored the query. Let's monitor the performance now.\\n\\n>>> Chatbot: Sure. Let's see if the changes have improved the query execution.\\n\\nQUERY PLAN\\n```sql\\n------------------------------------------------------------------------------------------------------------------\\n Hash Join  (cost=29.78..2017.78 rows=1000 width=122) (actual time=0.208..10.962 rows=987 loops=1)\\n   Hash Cond: (o.user_id = u.user_id)\\n   ->  Seq Scan on orders o  (cost=0.00..1793.00 rows=1000 width=92) (actual time=0.012..7.325 rows=987 loops=1)\\n         Filter: (status = 'active'::order_status)\\n         Rows Removed by Filter: 9013\\n   ->  Hash  (cost=19.00..19.00 rows=940 width=36) (actual time=0.147..0.148 rows=940 loops=1)\\n         Buckets: 1024  Batches: 1  Memory Usage: 54kB\\n         ->  Seq Scan on users u  (cost=0.00..19.00 rows=940 width=36) (actual time=0.006..0.105 rows=940 loops=1)\\n Planning Time: 0.162 ms\\n Execution Time: 11.612 ms\\n(10 rows)\\n```\\n\\n>>> Human Agent: Confirmed! the query performance has improved. Can you check if there are any related alerts for this incident?\\n\\n>>> Chatbot: Sure, checking for related alerts now.\\n\\n alert_id | alert_type | alert_message                                  | timestamp\\n----------+------------+------------------------------------------------+---------------------\\n  12345   | DATABASE   | High latency detected on DB01                  | 2024-05-05 10:45:00\\n  12346   | NETWORK    | Load balancer NET01 experiencing high traffic  | 2024-05-05 10:50:00\\n  12347   | APPLICATION| API response time increased on APP01           | 2024-05-05 10:55:00\\n\\nThese alerts indicate high latency on DB01, high traffic on NET01, and increased API response time on APP01, which are likely related to the issue.\\n\\n>>> Human Agent: Thanks! This is very helpful.\\n\\n>>> Chatbot: You’re welcome! If you need any further assistance, feel free to ask. I'll update the incident with resolution details.\\n\"}",
                "{'content': '', 'tool_call_id': None, 'role': 'user', 'tool_calls': None}",
                "{'content': '<b>API Latency Due to Slow Database Queries</b><br>High API latency detected due to inefficient database queries. Optimization efforts include adding indexes, refactoring queries, and updating table statistics.\\n        \\n      NOC Virtual Agent (NVA) Summary:\\n  This Incident was processed by NVA and was assigned to this L2 resolver group:\\n  - Similar issues which have been resolved by this L2 resolver group.', 'tool_call_id': None, 'role': 'assistant', 'tool_calls': None}",
                "{'content': 'Create a p1 ticket for me', 'tool_call_id': None, 'role': 'user', 'tool_calls': None}",
              ],
              props: null,
            },
          ],
          followup_questions: null,
          citations: null,
          user: null,
        },
      },
    ],
    created: 1753210092,
    model: 'gpt-4o-2024-11-20',
    object: 'chat.completion',
    service_tier: null,
    system_fingerprint: 'fp_ee1d74bde0',
    usage: {
      completion_tokens: 172,
      prompt_tokens: 1967,
      total_tokens: 2139,
      completion_tokens_details: {
        accepted_prediction_tokens: 0,
        audio_tokens: 0,
        reasoning_tokens: 0,
        rejected_prediction_tokens: 0,
      },
      prompt_tokens_details: { audio_tokens: 0, cached_tokens: 0 },
    },
    prompt_filter_results: [
      {
        prompt_index: 0,
        content_filter_results: {
          hate: { filtered: false, severity: 'safe' },
          self_harm: { filtered: false, severity: 'safe' },
          sexual: { filtered: false, severity: 'safe' },
          violence: { filtered: false, severity: 'safe' },
        },
      },
    ],
  };

  useEffect(() => {
    if (selectedItem) {
      const initialResponse1: any = {
        id: 'chatcmpl-9QzsYBJMh9BunpueZlcyHcEJa8G04',
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            logprobs: null,
            message: {
              content:
                `<b>${selectedItem['Short description']}</b>` +
                '<br>' +
                `Similar 153 tickets have been reported.` +
                '<br>' +
                `I recommend you to create a <b>problem ticket</b> to resolve this issue`,
              role: 'assistant',
              function_call: null,
              tool_calls: null,
            },
            context: {
              data_points: null,
              thoughts: [
                {
                  title: 'Primary Cache',
                  description: {
                    user_id: null,
                    user_id_check_failed: false,
                    ticket_data: {
                      action_type: '',
                      ticket_id: '',
                      ticket_subject: '',
                      ticket_description: '',
                      ticket_urgency: '',
                      ticket_impact: '',
                    },
                    ticket_confirmation_data: {
                      ticket_action_requested: false,
                      ticket_details_observed: false,
                      ticket_action_confirmed: false,
                    },
                    issues_resolved: [],
                    issues_unresolved: [],
                    optimized_questions_so_far: [],
                  },
                  props: null,
                },
                {
                  title: 'Rag Context',
                  description: ['Hello! How can I assist you today?'],
                  props: null,
                },
                {
                  title: 'Incident History',
                  description: null,
                  props: null,
                },
                {
                  title: 'Original user query',
                  description: 'hello',
                  props: null,
                },
                {
                  title: 'Prompt',
                  description: [
                    "{'role': 'system', 'content': ...}",
                    "{'role': 'user', 'content': ...}",
                  ],
                  props: null,
                },
              ],
              followup_questions: [],
              citations: [],
              user: null,
            },
          },
        ],
        created: 1716221418,
        model: 'gpt-3.5-turbo-0125',
        object: 'chat.completion',
        system_fingerprint: null,
        usage: {
          completion_tokens: 9,
          prompt_tokens: 541,
          total_tokens: 550,
        },
      };

      const initialResponse2: any = {
        id: 'chatcmpl-9QzsYBJMh9BunpueZlcyHcEJa8G04',
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            logprobs: null,
            message: {
              content:
                `<b>${selectedItem['Short description']}</b>` +
                '<br>' +
                `There are many similar tickets that doesnt have a knowledge base.` +
                '<br>' +
                `You can create knowledgebase to improve resolution`,
              role: 'assistant',
              function_call: null,
              tool_calls: null,
            },
            context: {
              data_points: null,
              thoughts: [
                {
                  title: 'Primary Cache',
                  description: {
                    user_id: null,
                    user_id_check_failed: false,
                    ticket_data: {
                      action_type: '',
                      ticket_id: '',
                      ticket_subject: '',
                      ticket_description: '',
                      ticket_urgency: '',
                      ticket_impact: '',
                    },
                    ticket_confirmation_data: {
                      ticket_action_requested: false,
                      ticket_details_observed: false,
                      ticket_action_confirmed: false,
                    },
                    issues_resolved: [],
                    issues_unresolved: [],
                    optimized_questions_so_far: [],
                  },
                  props: null,
                },
                {
                  title: 'Rag Context',
                  description: ['Hello! How can I assist you today?'],
                  props: null,
                },
                {
                  title: 'Incident History',
                  description: null,
                  props: null,
                },
                {
                  title: 'Original user query',
                  description: 'hello',
                  props: null,
                },
                {
                  title: 'Prompt',
                  description: [
                    "{'role': 'system', 'content': ...}",
                    "{'role': 'user', 'content': ...}",
                  ],
                  props: null,
                },
              ],
              followup_questions: [],
              citations: [],
              user: null,
            },
          },
        ],
        created: 1716221418,
        model: 'gpt-3.5-turbo-0125',
        object: 'chat.completion',
        system_fingerprint: null,
        usage: {
          completion_tokens: 9,
          prompt_tokens: 541,
          total_tokens: 550,
        },
      };
      if (selectedItem['Tertiary Category'] === 'Shift Review') {
        setAnswers([['', initialResponse2]]);
      } else {
        setAnswers([['', initialResponse1]]);
      }
    }
  }, [selectedItem]);

  useEffect(
    () => chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' }),
    [isLoading],
  );

  const makeApiRequest = async (question: string) => {
    lastQuestionRef.current = question;
    setIsLoading(true);
    setError(undefined);
    setActiveCitation(undefined);
    setShowCitation(false);

    try {
      const messages: any[] = answers.flatMap((a) => [
        { content: a[0], role: 'user' },
        { content: a[1].choices[0].message.content, role: 'assistant' },
      ]);

      const response = await ExpertChatApi(
        messages,
        question,
        selectedItem?.Number,
        user?.org_id,
        'v1',
      );
      if (selectedItem['Tertiary Category'] === 'Shift Review') {
        setAnswers([...answers, [question, assistantReply2]]);
      } else {
        setAnswers([...answers, [question, assistantReply1]]);
      }
    } catch (e) {
      if (selectedItem['Tertiary Category'] === 'Shift Review') {
        setAnswers([...answers, [question, assistantReply2]]);
      } else {
        setAnswers([...answers, [question, assistantReply1]]);
      }
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  const onExampleClicked = (example: string) => {
    makeApiRequest(example);
  };

  const onShowCitation = (citation: string) => {
    setActiveCitation(citation);
    setShowCitation(true);
  };

  const renderChatContent = () => {
    if (answers.length === 0 && !lastQuestionRef.current) {
      return <ExampleList onExampleClicked={onExampleClicked} organization={organization} />;
    }

    return (
      <Flex direction="column" className="h-full w-full overflow-auto">
        {answers.map((answer, index) => (
          <QuestionAndAnswer
            key={index}
            question={index === 0 ? 'Get details on this ticket' : answer[0]}
            answer={answer[1]}
            isLoading={false}
            error={null}
            assistantName="Cross Functional Co-Resolve"
            onCitationClicked={(c) => onShowCitation(c)}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
          />
        ))}

        {isLoading && (
          <QuestionAndAnswer
            question={lastQuestionRef.current}
            answer={null}
            isLoading
            error={null}
            assistantName="Cross Functional Co-Resolve"
            onCitationClicked={() => {}}
            onRetry={() => {}}
            userName={user?.name}
            profilePic={user?.profile_pic}
          />
        )}

        <div ref={chatMessageStreamEnd} />
      </Flex>
    );
  };

  return (
    <Flex direction="column" className="h-full">
      <Flex direction="column" className="flex-grow overflow-y-auto">
        {renderChatContent()}
      </Flex>
      <Box className="flex-shrink-0">
        <QuestionInput
          clearOnSend
          isLoading={isLoading}
          isStreaming={false}
          onSend={(question) => makeApiRequest(question)}
          followUpQuestions={[]}
          onFollowupQuestionClicked={(q) => makeApiRequest(q)}
        />
      </Box>
      {showCitation && !!activeCitation && (
        <div className="_modal z-50">
          <PDFModal onClose={() => setShowCitation(false)} url={activeCitation} />
        </div>
      )}
    </Flex>
  );
};

export default ChatSection;
