-- Default workflow templates

INSERT OR IGNORE INTO templates (id, name, description, config) VALUES
(
  'tpl-code-review',
  'Code Review (3 agents)',
  'Three-agent team for thorough code review: reviewer, security auditor, and test writer.',
  json('{"agents":[{"name":"Reviewer","role":"Primary code reviewer. Reads diffs, checks logic, suggests improvements.","model_tier":"sonnet","tool_permissions":{"can_create_files":false,"can_run_commands":false,"can_push_git":false}},{"name":"Security Auditor","role":"Scans code changes for security vulnerabilities, injection risks, and credential exposure.","model_tier":"sonnet","tool_permissions":{"can_create_files":false,"can_run_commands":true,"can_push_git":false}},{"name":"Test Writer","role":"Writes or updates tests to cover the changed code paths.","model_tier":"sonnet","tool_permissions":{"can_create_files":true,"can_run_commands":true,"can_push_git":false}}],"governance":{"max_turns":20}}')
),
(
  'tpl-fullstack-feature',
  'Full-stack Feature (4 agents)',
  'Four-agent team for building a full-stack feature: architect, backend, frontend, and QA.',
  json('{"agents":[{"name":"Architect","role":"Plans the implementation, defines interfaces, and coordinates the other agents.","model_tier":"opus","tool_permissions":{"can_create_files":true,"can_run_commands":false,"can_push_git":false}},{"name":"Backend","role":"Implements server-side logic, API routes, and database changes.","model_tier":"sonnet","tool_permissions":{"can_create_files":true,"can_run_commands":true,"can_push_git":false}},{"name":"Frontend","role":"Implements UI components, pages, and client-side logic.","model_tier":"sonnet","tool_permissions":{"can_create_files":true,"can_run_commands":true,"can_push_git":false}},{"name":"QA","role":"Writes tests, runs the test suite, and reports failures.","model_tier":"sonnet","tool_permissions":{"can_create_files":true,"can_run_commands":true,"can_push_git":false}}],"governance":{"max_turns":30}}')
),
(
  'tpl-research-sprint',
  'Research Sprint (2 agents)',
  'Two-agent team for rapid research: one agent explores and documents, another synthesizes findings.',
  json('{"agents":[{"name":"Explorer","role":"Reads codebase, searches for patterns, documents findings in structured notes.","model_tier":"haiku","tool_permissions":{"can_create_files":true,"can_run_commands":true,"can_push_git":false}},{"name":"Synthesizer","role":"Reads explorer notes, identifies themes, produces a final summary report.","model_tier":"sonnet","tool_permissions":{"can_create_files":true,"can_run_commands":false,"can_push_git":false}}],"governance":{"max_turns":15}}')
);
