/**
 * SkillPanel — Skill management panel
 *
 * Displays a list of installed skills from .llm-assistant/skills/
 * Allows enabling, disabling, installing, and deleting skills.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LLMApiService } from '../services/api';
import { Skill } from '../models/types';

interface SkillPanelProps {
  onClose: () => void;
  rootDir: string;
  onRootDirChange?: (newRootDir: string) => void;
}

const _api = new LLMApiService();

export const SkillPanel: React.FC<SkillPanelProps> = ({
  onClose,
  rootDir,
  onRootDirChange,
}) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [updatingName, setUpdatingName] = useState<string | null>(null);
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [installName, setInstallName] = useState('');
  const [installManifest, setInstallManifest] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMode, setInstallMode] = useState<'yaml' | 'url'>('url');
  const [showRootDirEdit, setShowRootDirEdit] = useState(false);
  const [rootDirInput, setRootDirInput] = useState(rootDir);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState('');

  // Marketplace state
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [registries, setRegistries] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedRegistry, setSelectedRegistry] = useState<string | null>(null);
  const [marketplaceSkills, setMarketplaceSkills] = useState<Array<{
    name: string;
    description: string;
    url: string;
    author: string;
    tags: string[];
    version: string;
  }>>([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await _api.listSkills(rootDir);
      const skills: Skill[] = data.map(s => ({
        ...s,
        type: s.type as 'file' | 'directory',
      }));
      setSkills(skills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setIsLoading(false);
    }
  }, [rootDir]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    setRootDirInput(rootDir);
  }, [rootDir]);

  const handleToggleEnabled = async (skill: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingName(skill.name);
    try {
      await _api.updateSkill(skill.name, { enabled: !skill.enabled }, rootDir);
      await loadSkills();
    } catch (err) {
      console.error('Failed to toggle skill:', err);
    } finally {
      setUpdatingName(null);
    }
  };

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete skill "${name}"? This cannot be undone.`)) {
      return;
    }
    setDeletingName(name);
    try {
      await _api.deleteSkill(name, rootDir);
      await loadSkills();
    } catch (err) {
      console.error('Failed to delete skill:', err);
    } finally {
      setDeletingName(null);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setInstallError(null);

    try {
      if (installMode === 'url') {
        // Install from URL (GitHub or raw)
        if (!installUrl.trim()) {
          setInstallError('URL is required');
          setInstalling(false);
          return;
        }

        let url = installUrl.trim();

        // Handle GitHub shorthand: github:user/repo/skill-name
        if (url.startsWith('github:')) {
          const parts = url.substring(7).split('/');
          if (parts.length >= 3) {
            const [user, repo, ...skillPath] = parts;
            url = `https://github.com/${user}/${repo}/tree/main/${skillPath.join('/')}`;
          } else {
            setInstallError('Invalid GitHub shorthand. Use: github:user/repo/skill-name');
            setInstalling(false);
            return;
          }
        }

        const result = await _api.installSkillFromUrl(url, rootDir);
        setInstallUrl('');
        setShowInstallForm(false);
        await loadSkills();

      } else {
        // Install from YAML manifest
        if (!installName.trim()) {
          setInstallError('Skill name is required');
          setInstalling(false);
          return;
        }

        // Parse the YAML manifest
        let manifest: Record<string, any> = {};
        try {
          // Simple YAML parsing - in production you'd use a proper YAML parser
          const lines = installManifest.split('\n');
          let inSystemPrompt = false;
          let systemPromptLines: string[] = [];

          for (const line of lines) {
            if (inSystemPrompt) {
              if (line.match(/^\s{2,}/) || line.startsWith('\t')) {
                systemPromptLines.push(line);
              } else if (line.trim() === '') {
                inSystemPrompt = false;
                manifest['system_prompt'] = systemPromptLines.join('\n').trim();
              } else {
                inSystemPrompt = false;
              }
            }

            const trimmed = line.trim();
            if (trimmed.startsWith('name:')) {
              manifest['name'] = trimmed.substring(5).trim().replace(/^["']|["']$/g, '');
            } else if (trimmed.startsWith('version:')) {
              manifest['version'] = trimmed.substring(8).trim().replace(/^["']|["']$/g, '');
            } else if (trimmed.startsWith('description:')) {
              manifest['description'] = trimmed.substring(12).trim().replace(/^["']|["']$/g, '');
            } else if (trimmed.startsWith('author:')) {
              manifest['author'] = trimmed.substring(7).trim().replace(/^["']|["']$/g, '');
            } else if (trimmed.startsWith('system_prompt:')) {
              const rest = trimmed.substring(14).trim();
              if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
                inSystemPrompt = true;
                systemPromptLines = [];
              } else {
                manifest['system_prompt'] = rest.replace(/^["']|["']$/g, '');
              }
            } else if (trimmed.startsWith('enabled:')) {
              manifest['enabled'] = trimmed.substring(8).trim().toLowerCase() === 'true';
            }
          }

          if (inSystemPrompt && systemPromptLines.length > 0) {
            manifest['system_prompt'] = systemPromptLines.join('\n').trim();
          }

          manifest['enabled'] = manifest['enabled'] !== false;
        } catch (parseErr) {
          setInstallError('Invalid YAML format');
          setInstalling(false);
          return;
        }

        await _api.installSkill(installName.trim(), manifest, rootDir);
        setInstallName('');
        setInstallManifest('');
        setShowInstallForm(false);
        await loadSkills();
      }
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Failed to install skill');
    } finally {
      setInstalling(false);
    }
  };

  const handleRootDirSave = () => {
    if (onRootDirChange && rootDirInput !== rootDir) {
      onRootDirChange(rootDirInput);
    }
    setShowRootDirEdit(false);
  };

  const handleEditPrompt = (skill: Skill) => {
    setSelectedSkill(skill);
    setPromptInput(skill.systemPrompt || '');
    setEditingPrompt(skill.name);
  };

  const handleSavePrompt = async () => {
    if (!selectedSkill) return;
    setUpdatingName(selectedSkill.name);
    try {
      await _api.updateSkill(
        selectedSkill.name,
        { system_prompt: promptInput },
        rootDir
      );
      setEditingPrompt(null);
      setSelectedSkill(null);
      await loadSkills();
    } catch (err) {
      console.error('Failed to save skill prompt:', err);
    } finally {
      setUpdatingName(null);
    }
  };

  const formatManifest = (manifest: Record<string, any>): string => {
    let result = '';
    if (manifest.name) result += `name: ${manifest.name}\n`;
    if (manifest.version) result += `version: "${manifest.version}"\n`;
    if (manifest.description) result += `description: "${manifest.description}"\n`;
    if (manifest.author) result += `author: "${manifest.author}"\n`;
    if (manifest.system_prompt) {
      result += `system_prompt: |\n${manifest.system_prompt.split('\n').map((l: string) => '  ' + l).join('\n')}\n`;
    }
    result += `enabled: ${manifest.enabled !== false ? 'true' : 'false'}\n`;
    return result.trim();
  };

  // Marketplace handlers
  const loadRegistries = async () => {
    setLoadingMarketplace(true);
    setMarketplaceError(null);
    try {
      const regs = await _api.listRegistries();
      setRegistries(regs);
    } catch (err) {
      setMarketplaceError(err instanceof Error ? err.message : 'Failed to load registries');
    } finally {
      setLoadingMarketplace(false);
    }
  };

  const loadRegistrySkills = async (registryId: string) => {
    setSelectedRegistry(registryId);
    setLoadingMarketplace(true);
    setMarketplaceError(null);
    try {
      const data = await _api.getRegistrySkills(registryId);
      setMarketplaceSkills(data.skills);
    } catch (err) {
      setMarketplaceError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoadingMarketplace(false);
    }
  };

  const handleInstallFromMarketplace = async (skill: {
    name: string;
    description: string;
    url: string;
    author: string;
  }) => {
    setInstalling(true);
    setInstallError(null);
    try {
      // Use the URL to install the skill
      let url = skill.url;
      // Handle GitHub shorthand
      if (url.startsWith('github:')) {
        const parts = url.substring(7).split('/');
        if (parts.length >= 3) {
          const [user, repo, ...skillPath] = parts;
          url = `https://github.com/${user}/${repo}/tree/main/${skillPath.join('/')}`;
        }
      }
      await _api.installSkillFromUrl(skill.name, url, rootDir);
      await loadSkills();
      setShowMarketplace(false);
      setSelectedRegistry(null);
      setMarketplaceSkills([]);
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Failed to install skill');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="llm-skill-panel">
      <div className="llm-skill-header">
        <h4>Skills</h4>
        <div className="llm-skill-header-actions">
          <button
            className={`llm-header-btn ${showMarketplace ? 'active' : ''}`}
            onClick={() => {
              setShowMarketplace(!showMarketplace);
              if (!showMarketplace && registries.length === 0) {
                loadRegistries();
              }
            }}
            title="Browse Marketplace"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
          <button
            className="llm-header-btn"
            onClick={() => setShowInstallForm(!showInstallForm)}
            title="Install Skill"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          <button className="llm-close-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Project Directory Section */}
      <div className="llm-rootdir-section">
        <div className="llm-rootdir-header">
          <span className="llm-rootdir-label">Project Directory</span>
          <button
            className="llm-rootdir-edit-btn"
            onClick={() => setShowRootDirEdit(!showRootDirEdit)}
            title="Edit project directory"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
        </div>
        {showRootDirEdit ? (
          <div className="llm-rootdir-edit">
            <input
              type="text"
              className="llm-rootdir-input"
              value={rootDirInput}
              onChange={(e) => setRootDirInput(e.target.value)}
              placeholder="Enter project directory path..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRootDirSave();
                if (e.key === 'Escape') setShowRootDirEdit(false);
              }}
              autoFocus
            />
            <div className="llm-rootdir-actions">
              <button className="llm-rootdir-save" onClick={handleRootDirSave}>
                Save
              </button>
              <button className="llm-rootdir-cancel" onClick={() => setShowRootDirEdit(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="llm-rootdir-path" title={rootDir}>
            {rootDir || 'Using current working directory'}
          </div>
        )}
      </div>

      {/* Install Form */}
      {showInstallForm && (
        <div className="llm-skill-install-form">
          <h5>Install Skill</h5>

          {/* Install Mode Toggle */}
          <div className="llm-skill-install-toggle">
            <button
              className={installMode === 'url' ? 'active' : ''}
              onClick={() => setInstallMode('url')}
            >
              From URL / GitHub
            </button>
            <button
              className={installMode === 'yaml' ? 'active' : ''}
              onClick={() => setInstallMode('yaml')}
            >
              From YAML
            </button>
          </div>

          {installMode === 'url' && (
            <div className="llm-skill-install-field">
              <label>GitHub URL or Raw URL</label>
              <input
                type="text"
                value={installUrl}
                onChange={(e) => setInstallUrl(e.target.value)}
                placeholder="https://github.com/user/repo/tree/main/skill-name"
              />
              <p className="llm-settings-hint">
                Supports GitHub URLs, raw URLs, or shorthand: <code>github:user/repo/skill</code>
              </p>
            </div>
          )}
          {installMode === 'yaml' && (
            <>
          <div className="llm-skill-install-field">
            <label>Skill Name</label>
            <input
              type="text"
              value={installName}
              onChange={(e) => setInstallName(e.target.value)}
              placeholder="e.g., code-review, test-generator"
            />
          </div>
          <div className="llm-skill-install-field">
            <label>YAML Manifest</label>
            <textarea
              value={installManifest}
              onChange={(e) => setInstallManifest(e.target.value)}
              placeholder={`name: my-skill
version: "1.0.0"
description: "Does something useful"
system_prompt: |
  You have access to special tools...
enabled: true`}
              rows={8}
            />
          </div>
            </>
          )}
          {installError && <div className="llm-skill-install-error">{installError}</div>}
          <div className="llm-skill-install-actions">
            <button
              className="llm-cancel-btn"
              onClick={() => {
                setShowInstallForm(false);
                setInstallName('');
                setInstallManifest('');
                setInstallUrl('');
                setInstallError(null);
              }}
            >
              Cancel
            </button>
            <button
              className="llm-save-btn"
              onClick={handleInstall}
              disabled={installing || (installMode === 'url' ? !installUrl.trim() : !installName.trim())}
            >
              {installing ? 'Installing...' : 'Install'}
            </button>
          </div>
        </div>
      )}

      {/* Marketplace Section */}
      {showMarketplace && (
        <div className="llm-skill-marketplace">
          <div className="llm-marketplace-header">
            <h5>Skill Marketplace</h5>
            <button
              className="llm-marketplace-close"
              onClick={() => {
                setShowMarketplace(false);
                setSelectedRegistry(null);
                setMarketplaceSkills([]);
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {loadingMarketplace && <div className="llm-loading">Loading marketplace...</div>}

          {marketplaceError && (
            <div className="llm-skill-error">
              <span>{marketplaceError}</span>
              <button onClick={loadRegistries}>Retry</button>
            </div>
          )}

          {!loadingMarketplace && !marketplaceError && !selectedRegistry && (
            <div className="llm-marketplace-registries">
              <p className="llm-marketplace-hint">Select a marketplace to browse skills:</p>
              {registries.map((reg) => (
                <div
                  key={reg.id}
                  className="llm-registry-item"
                  onClick={() => loadRegistrySkills(reg.id)}
                >
                  <div className="llm-registry-name">{reg.name}</div>
                  <div className="llm-registry-desc">{reg.description}</div>
                </div>
              ))}
            </div>
          )}

          {!loadingMarketplace && !marketplaceError && selectedRegistry && (
            <div className="llm-marketplace-skills">
              <button
                className="llm-marketplace-back"
                onClick={() => {
                  setSelectedRegistry(null);
                  setMarketplaceSkills([]);
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                Back to marketplaces
              </button>
              <div className="llm-marketplace-skill-list">
                {marketplaceSkills.length === 0 ? (
                  <p className="llm-marketplace-empty">No skills found in this marketplace</p>
                ) : (
                  marketplaceSkills.map((skill) => (
                    <div key={skill.name} className="llm-marketplace-skill-item">
                      <div className="llm-marketplace-skill-info">
                        <div className="llm-marketplace-skill-name">
                          {skill.name}
                          {skill.version && (
                            <span className="llm-skill-version">v{skill.version}</span>
                          )}
                        </div>
                        <div className="llm-marketplace-skill-desc">{skill.description}</div>
                        {skill.author && (
                          <div className="llm-marketplace-skill-author">by {skill.author}</div>
                        )}
                        {skill.tags && skill.tags.length > 0 && (
                          <div className="llm-marketplace-skill-tags">
                            {skill.tags.map((tag) => (
                              <span key={tag} className="llm-marketplace-tag">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="llm-marketplace-install-btn"
                        onClick={() => handleInstallFromMarketplace(skill)}
                        disabled={installing}
                      >
                        {installing ? 'Installing...' : 'Install'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skill List */}
      <div className="llm-skill-content">
        {isLoading && <div className="llm-loading">Loading skills...</div>}

        {error && (
          <div className="llm-skill-error">
            <span>{error}</span>
            <button onClick={loadSkills}>Retry</button>
          </div>
        )}

        {!isLoading && !error && skills.length === 0 && !showInstallForm && (
          <div className="llm-skill-empty">
            <p>No skills installed</p>
            <p className="llm-hint">Skills extend the assistant's capabilities</p>
            <button
              className="llm-install-sample-btn"
              onClick={() => {
                setInstallName('example-skill');
                setInstallManifest(`name: example-skill
version: "1.0.0"
description: "An example skill demonstrating the skill system"
system_prompt: |
  You are an AI assistant with expertise in the example skill domain.
  When relevant, apply the following special instructions:
  - Consider best practices for the domain
  - Provide detailed explanations
enabled: true`);
                setShowInstallForm(true);
              }}
            >
              Install Example Skill
            </button>
          </div>
        )}

        {!isLoading && !error && skills.length > 0 && (
          <div className="llm-skill-list">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className={`llm-skill-item ${!skill.enabled ? 'llm-skill-disabled' : ''}`}
                onClick={() => setSelectedSkill(selectedSkill?.name === skill.name ? null : skill)}
              >
                <div className="llm-skill-info">
                  <div className="llm-skill-name">
                    {skill.name}
                    {skill.version && (
                      <span className="llm-skill-version">v{skill.version}</span>
                    )}
                  </div>
                  <div className="llm-skill-meta">
                    {skill.description && (
                      <span className="llm-skill-description">{skill.description}</span>
                    )}
                    {skill.author && (
                      <span className="llm-skill-author">by {skill.author}</span>
                    )}
                  </div>
                </div>
                <div className="llm-skill-actions">
                  <button
                    className={`llm-skill-toggle ${skill.enabled ? 'llm-enabled' : 'llm-disabled'}`}
                    onClick={(e) => handleToggleEnabled(skill, e)}
                    disabled={updatingName === skill.name}
                    title={skill.enabled ? 'Disable skill' : 'Enable skill'}
                  >
                    {updatingName === skill.name ? (
                      <span className="llm-spinner" />
                    ) : skill.enabled ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    )}
                  </button>
                  <button
                    className="llm-skill-delete"
                    onClick={(e) => handleDelete(skill.name, e)}
                    disabled={deletingName === skill.name}
                    title="Delete skill"
                  >
                    {deletingName === skill.name ? (
                      <span className="llm-spinner" />
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Skill Detail */}
        {selectedSkill && editingPrompt !== selectedSkill.name && (
          <div className="llm-skill-detail">
            <h5>{selectedSkill.name}</h5>
            {selectedSkill.description && (
              <p className="llm-skill-detail-desc">{selectedSkill.description}</p>
            )}
            {selectedSkill.systemPrompt && (
              <div className="llm-skill-detail-prompt">
                <label>System Prompt</label>
                <pre className="llm-skill-prompt-preview">{selectedSkill.systemPrompt}</pre>
              </div>
            )}
            <div className="llm-skill-detail-actions">
              <button
                className="llm-edit-prompt-btn"
                onClick={() => handleEditPrompt(selectedSkill)}
              >
                Edit System Prompt
              </button>
            </div>
          </div>
        )}

        {/* Edit Prompt Form */}
        {editingPrompt && (
          <div className="llm-skill-edit-prompt">
            <h5>Edit System Prompt: {selectedSkill?.name}</h5>
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              rows={10}
              placeholder="Enter the system prompt for this skill..."
            />
            <div className="llm-skill-edit-actions">
              <button
                className="llm-cancel-btn"
                onClick={() => {
                  setEditingPrompt(null);
                  setSelectedSkill(null);
                  setPromptInput('');
                }}
              >
                Cancel
              </button>
              <button
                className="llm-save-btn"
                onClick={handleSavePrompt}
                disabled={updatingName !== null}
              >
                {updatingName ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillPanel;