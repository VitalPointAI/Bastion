/**
 * Skill Loader
 *
 * Discovers .md skill definition files from the skills/ directory,
 * parses their YAML frontmatter, and registers them in the SkillRegistry.
 *
 * Each .md file defines a skill declaratively:
 *   - Frontmatter: skillId, name, description, schemas, handler reference
 *   - Body: human-readable documentation (overview, tactical context, constraints)
 *
 * The `handler` field maps to a TypeScript function in the handler registry.
 *
 * Runs on server startup — idempotent (upserts on skillId).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ---------------------------------------------------------------------------
// Frontmatter parser (minimal — avoids js-yaml dependency)
// ---------------------------------------------------------------------------

interface SkillFrontmatter {
  skillId: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  systemPromptFragment?: string;
  handler: string;
}

/**
 * Parse YAML-like frontmatter from a markdown file.
 * Handles simple scalars, arrays (both inline [...] and indented - item),
 * multiline strings (|), and nested objects (via JSON.parse fallback for schemas).
 */
function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2];
  const data: Record<string, unknown> = {};

  const lines = yamlBlock.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);

    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    const value = keyMatch[2].trim();

    // Multiline string (|)
    if (value === '|') {
      const multiLines: string[] = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        multiLines.push(lines[i].replace(/^ {2}/, ''));
        i++;
      }
      data[key] = multiLines.join('\n').trim();
      continue;
    }

    // Inline array: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      data[key] = inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      i++;
      continue;
    }

    // Indented block (object or array)
    if (value === '' || value === '') {
      // Check next line for indentation
      const block: string[] = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        block.push(lines[i]);
        i++;
      }

      const blockText = block.join('\n');

      // Try to detect if it's a YAML array (lines starting with "  - ")
      if (block.some((l) => l.trimStart().startsWith('- '))) {
        const items: string[] = [];
        for (const bl of block) {
          const itemMatch = bl.match(/^\s*-\s+(.+)$/);
          if (itemMatch) items.push(itemMatch[1].replace(/^["']|["']$/g, ''));
        }
        data[key] = items;
        continue;
      }

      // Try JSON parse for complex schemas
      try {
        // Convert YAML-ish indented block to JSON
        const jsonAttempt = yamlBlockToJson(blockText);
        data[key] = JSON.parse(jsonAttempt);
      } catch {
        data[key] = blockText.trim();
      }
      continue;
    }

    // Simple scalar
    if (value === 'true') data[key] = true;
    else if (value === 'false') data[key] = false;
    else if (/^\d+(\.\d+)?$/.test(value)) data[key] = parseFloat(value);
    else data[key] = value.replace(/^["']|["']$/g, '');

    i++;
  }

  return { data, body };
}

/**
 * Convert indented YAML-like block to JSON string (best effort).
 */
function yamlBlockToJson(block: string): string {
  const lines = block.split('\n');
  let json = '{\n';
  const stack: number[] = [0];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const indent = line.search(/\S/);
    const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);

    if (!kvMatch) continue;

    const k = kvMatch[1];
    const v = kvMatch[2].trim();

    // Close deeper levels
    while (stack.length > 1 && indent <= stack[stack.length - 1]) {
      json += '},\n';
      stack.pop();
    }

    if (v === '') {
      // Nested object
      json += `"${k}": {\n`;
      stack.push(indent + 2);
    } else if (v.startsWith('[') && v.endsWith(']')) {
      // Inline array
      const items = v.slice(1, -1).split(',').map((s) => {
        const t = s.trim().replace(/^["']|["']$/g, '');
        return `"${t}"`;
      });
      json += `"${k}": [${items.join(', ')}],\n`;
    } else if (v === 'true' || v === 'false') {
      json += `"${k}": ${v},\n`;
    } else if (/^\d+$/.test(v)) {
      json += `"${k}": ${v},\n`;
    } else {
      json += `"${k}": "${v.replace(/^["']|["']$/g, '')}",\n`;
    }
  }

  // Close remaining levels
  while (stack.length > 1) {
    json += '},\n';
    stack.pop();
  }

  json += '}';

  // Clean trailing commas before closing braces
  json = json.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  return json;
}

// ---------------------------------------------------------------------------
// Skill discovery
// ---------------------------------------------------------------------------

export interface LoadedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  filePath: string;
}

/**
 * Discover and parse all .md skill files from the skills/ directory tree.
 */
export function discoverSkillFiles(): LoadedSkill[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const skillsDir = __dirname; // skills/ directory

  const skills: LoadedSkill[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        // Skip non-skill directories
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        walk(fullPath);
      } else if (entry.endsWith('.md')) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const { data, body } = parseFrontmatter(content);

          if (!data.skillId || !data.name || !data.handler) {
            console.warn(`[SkillLoader] Skipping ${relative(skillsDir, fullPath)} — missing required frontmatter (skillId, name, handler)`);
            continue;
          }

          skills.push({
            frontmatter: {
              skillId: data.skillId as string,
              name: data.name as string,
              description: (data.description as string) ?? '',
              version: (data.version as string) ?? '1.0.0',
              category: (data.category as string) ?? 'general',
              tags: (data.tags as string[]) ?? [],
              inputSchema: (data.inputSchema as Record<string, unknown>) ?? {},
              outputSchema: data.outputSchema as Record<string, unknown> | undefined,
              systemPromptFragment: data.systemPromptFragment as string | undefined,
              handler: data.handler as string,
            },
            body,
            filePath: relative(skillsDir, fullPath),
          });
        } catch (err) {
          console.error(`[SkillLoader] Failed to parse ${fullPath}:`, err);
        }
      }
    }
  }

  walk(skillsDir);
  return skills;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Load all .md skill files and register them in the SkillRegistry.
 * Idempotent — uses upsert (createSkill does ON CONFLICT).
 */
export async function loadAndRegisterSkills(): Promise<number> {
  const { getSkillRegistry } = await import('../agents/skill-registry.js');
  const registry = getSkillRegistry();

  const skills = discoverSkillFiles();
  let registered = 0;

  for (const skill of skills) {
    const { frontmatter: fm } = skill;
    try {
      await registry.createSkill({
        skillId: fm.skillId,
        name: fm.name,
        description: fm.description,
        version: fm.version,
        isEnabled: true,
        inputSchema: fm.inputSchema,
        outputSchema: fm.outputSchema,
        systemPromptFragment: fm.systemPromptFragment,
        toolIds: [],
        metadata: {
          category: fm.category,
          tags: fm.tags,
          handler: fm.handler,
          sourceFile: skill.filePath,
        },
        createdBy: 'system:skill-loader',
      });
      registered++;
    } catch (err) {
      console.error(`[SkillLoader] Failed to register ${fm.skillId}:`, err);
    }
  }

  console.log(`[SkillLoader] Registered ${registered}/${skills.length} skills from .md files`);
  return registered;
}
