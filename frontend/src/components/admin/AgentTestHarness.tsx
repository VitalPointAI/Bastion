/**
 * AgentTestHarness Component
 *
 * Phase 51: Test prompt panel for individual agents.
 *
 * Sends a prompt to an agent and displays the output + timing.
 * Supports optional skill selection from the agent's skills list.
 */

import { useState } from 'react';
import { adminService } from '../../lib/admin-service';
import type { AgentTestResult, StandardAgentWithHealth } from '../../types/admin';

interface AgentTestHarnessProps {
  agent: StandardAgentWithHealth;
}

function formatTrace(trace: AgentTestResult['executionTrace']) {
  if (!trace || trace.length === 0) return null;
  return trace.map((t, i) => (
    <div key={i} className="test-trace-entry">
      <span className={`test-trace-status test-trace-status--${t.status}`}>
        {t.status}
      </span>
      <span className="test-trace-op">{t.operation}</span>
      {t.durationMs !== undefined && (
        <span className="test-trace-duration">{t.durationMs}ms</span>
      )}
      {t.error && (
        <span className="test-trace-error" title={t.error}>
          {t.error.substring(0, 100)}
        </span>
      )}
    </div>
  ));
}

export function AgentTestHarness({ agent }: AgentTestHarnessProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [result, setResult] = useState<AgentTestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract skill IDs from the agent's skills array
  const skills = (agent.skills || []).map((s) =>
    typeof s === 'string' ? s : (s as { skillId: string }).skillId
  );

  const handleRunTest = async () => {
    if (!prompt.trim()) {
      setError('Please enter a test prompt.');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const testResult = await adminService.testAgent(
        agent.agentId,
        prompt.trim(),
        selectedSkill || undefined
      );
      setResult(testResult);
      if (testResult.error) {
        setError(testResult.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="test-harness">
      <div className="test-harness__form">
        {skills.length > 0 && (
          <div className="test-harness__skill-row">
            <label className="form-label">Skill (optional)</label>
            <select
              className="form-select"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
            >
              <option value="">— No specific skill —</option>
              {skills.map((skillId) => (
                <option key={skillId} value={skillId}>
                  {skillId}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="test-harness__prompt-row">
          <label className="form-label">Test Prompt</label>
          <textarea
            className="form-input form-textarea"
            rows={4}
            placeholder="Enter a test prompt for this agent..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isRunning}
          />
        </div>

        <div className="test-harness__actions">
          <button
            className="btn btn--primary"
            onClick={handleRunTest}
            disabled={isRunning || !prompt.trim()}
          >
            {isRunning ? 'Running...' : 'Run Test'}
          </button>
          {result && (
            <button
              className="btn btn--secondary"
              onClick={() => { setResult(null); setError(null); }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && !result && (
        <div className="alert alert--error" style={{ marginTop: '12px' }}>
          <span className="alert-icon">!</span>
          {error}
        </div>
      )}

      {result && (
        <div className="test-harness__result">
          <div className="test-harness__result-header">
            <span className={`status-badge status-badge--${result.error ? 'error' : 'success'}`}>
              {result.error ? 'Failed' : 'Success'}
            </span>
            <span className="test-harness__timing">
              {result.durationMs}ms
            </span>
            {result.skill && (
              <span className="test-harness__skill-badge">
                Skill: {result.skill}
              </span>
            )}
          </div>

          {result.output !== null ? (
            <div className="test-harness__output">
              <pre className="test-harness__output-pre">
                {typeof result.output === 'string'
                  ? result.output
                  : JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="test-harness__output test-harness__output--empty">
              <em>(no output)</em>
            </div>
          )}

          {result.error && (
            <div className="alert alert--error" style={{ marginTop: '8px' }}>
              <span className="alert-icon">!</span>
              {result.error}
            </div>
          )}

          {result.executionTrace && result.executionTrace.length > 0 && (
            <div className="test-harness__trace">
              <h5 className="test-harness__trace-title">Execution Trace</h5>
              {formatTrace(result.executionTrace)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
