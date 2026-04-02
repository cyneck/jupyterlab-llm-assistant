"""
Skill Resolver — Fetches and installs skills from URLs (GitHub, raw, etc.)

Supports:
- Raw URLs: direct links to YAML files
- GitHub blob URLs: https://github.com/user/repo/blob/branch/path/skill.yaml
- GitHub tree URLs: https://github.com/user/repo/tree/branch/path (auto-finds skill.yaml)
- GitHub raw URLs: https://raw.githubusercontent.com/user/repo/branch/path/skill.yaml

Claude Code skill format compatibility:
- Single-file skills: skill.yaml
- Directory skills: skill.yaml + Python modules for custom tools
"""

import json
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

import yaml


@dataclass
class ResolvedSkill:
    """Result of resolving a skill URL."""
    name: str
    manifest: Dict[str, Any]
    content: str  # Raw YAML content
    source_url: str
    is_directory: bool = False
    files: Optional[Dict[str, str]] = None  # For directory skills: filename -> content


class GitHubURLResolver:
    """
    Resolves various GitHub URL formats to raw content URLs.

    Supported formats:
    - https://raw.githubusercontent.com/user/repo/branch/path/file.yaml
    - https://github.com/user/repo/blob/branch/path/file.yaml
    - https://github.com/user/repo/tree/branch/path (directory, looks for skill.yaml)
    """

    # Regex patterns for GitHub URLs
    RAW_PATTERN = re.compile(
        r'^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+)$'
    )
    BLOB_PATTERN = re.compile(
        r'^https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+\.yaml)$'
    )
    BLOB_DIR_PATTERN = re.compile(
        r'^https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+)/?$'
    )
    TREE_PATTERN = re.compile(
        r'^https://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.+)/?$'
    )

    @classmethod
    def resolve(cls, url: str) -> Tuple[str, Optional[str]]:
        """
        Resolve a GitHub URL to a raw content URL.

        Returns: (url, optional_etag)
        - For files: returns the raw URL directly
        - For directories: returns None (caller should use list_dir)
        """
        # Try raw URL first (direct pass-through)
        raw_match = cls.RAW_PATTERN.match(url)
        if raw_match:
            return url, None

        # Try blob file URL
        blob_match = cls.BLOB_PATTERN.match(url)
        if blob_match:
            user, repo, branch, path = blob_match.groups()
            raw_url = f"https://raw.githubusercontent.com/{user}/{repo}/{branch}/{path}"
            return raw_url, None

        # Try blob directory URL (look for skill.yaml inside)
        blob_dir_match = cls.BLOB_DIR_PATTERN.match(url)
        if blob_dir_match:
            # This is a directory - caller should list contents
            return None, None

        # Try tree URL
        tree_match = cls.TREE_PATTERN.match(url)
        if tree_match:
            # This is a directory - caller should list contents
            return None, None

        return None, None

    @classmethod
    def list_directory(cls, url: str) -> Dict[str, str]:
        """
        List files in a GitHub directory.

        For tree/blob URLs, returns a dict of filename -> download URL.
        """
        # Extract repo info from URL
        tree_match = cls.TREE_PATTERN.match(url)
        blob_dir_match = cls.BLOB_DIR_PATTERN.match(url)

        if not tree_match and not blob_dir_match:
            return {}

        if tree_match:
            user, repo, branch, path = tree_match.groups()
        else:
            user, repo, branch, path = blob_dir_match.groups()

        # Fetch the GitHub API for directory contents
        api_url = f"https://api.github.com/repos/{user}/{repo}/contents/{path}?ref={branch}"

        try:
            req = urllib.request.Request(
                api_url,
                headers={
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'JupyterLab-LLM-Assistant'
                }
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                contents = json.loads(response.read().decode('utf-8'))

            result = {}
            for item in contents:
                if item['type'] == 'file':
                    # Convert to raw URL
                    raw_url = item['download_url']
                    result[item['name']] = raw_url
                elif item['type'] == 'dir':
                    # Recursively get subdirectory
                    sub_result = cls.list_directory(item['url'])
                    for name, download_url in sub_result.items():
                        result[f"{item['name']}/{name}"] = download_url

            return result
        except Exception as e:
            print(f"Failed to list GitHub directory: {e}")
            return {}


def fetch_url_content(url: str, etag: Optional[str] = None) -> Tuple[str, Optional[str]]:
    """
    Fetch content from a URL.

    Returns: (content, new_etag)
    Uses ETag for caching when provided.
    """
    headers = {
        'Accept': 'text/plain, text/yaml, application/x-yaml',
        'User-Agent': 'JupyterLab-LLM-Assistant'
    }
    if etag:
        headers['If-None-Match'] = etag

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            content = response.read().decode('utf-8')
            new_etag = response.headers.get('ETag')
            return content, new_etag
    except urllib.error.HTTPError as e:
        if e.code == 304:
            return "", etag  # Not modified
        raise
    except Exception as e:
        raise Exception(f"Failed to fetch URL: {e}")


def is_github_url(url: str) -> bool:
    """Check if URL is a GitHub URL."""
    return (
        'github.com' in url or
        'raw.githubusercontent.com' in url
    )


def is_yaml_url(url: str) -> bool:
    """Check if URL points to a YAML file."""
    return url.endswith('.yaml') or url.endswith('.yml')


def resolve_skill_from_url(url: str) -> ResolvedSkill:
    """
    Resolve a skill from a URL.

    Handles:
    - Direct YAML URLs (raw content)
    - GitHub blob URLs (single file)
    - GitHub tree URLs (directory, finds skill.yaml)

    Returns ResolvedSkill with manifest and metadata.
    """
    url = url.strip()

    # Check if it's a GitHub URL
    if is_github_url(url):
        # Try to resolve to raw content
        resolved_url, _ = GitHubURLResolver.resolve(url)

        if resolved_url:
            # Direct file URL
            content, _ = fetch_url_content(resolved_url)
            return _parse_skill_content(content, resolved_url)
        else:
            # Directory URL - list and fetch files
            files = GitHubURLResolver.list_directory(url)

            # Look for skill.yaml or <dirname>.yaml
            skill_yaml_key = None
            for key in files:
                if key.endswith('/skill.yaml') or key.endswith('/skill.yml'):
                    skill_yaml_key = key
                    break

            if not skill_yaml_key:
                # Try to find a YAML file that matches the directory name
                dir_name = url.rstrip('/').split('/')[-1]
                for key in files:
                    if key.endswith(f'/{dir_name}.yaml') or key.endswith(f'/{dir_name}.yml'):
                        skill_yaml_key = key
                        break

            if not skill_yaml_key:
                raise Exception(f"No skill.yaml found in directory: {url}")

            # Fetch skill.yaml
            skill_yaml_url = files[skill_yaml_key]
            content, _ = fetch_url_content(skill_yaml_url)

            # Fetch all other files in the skill directory
            all_files = {}
            skill_dir = str(Path(skill_yaml_key).parent)
            for key, download_url in files.items():
                if key.startswith(skill_dir) or key == skill_yaml_key:
                    file_content, _ = fetch_url_content(download_url)
                    # Get relative path within skill directory
                    rel_path = key[len(skill_dir):].lstrip('/')
                    all_files[rel_path] = file_content

            # Parse manifest
            manifest = yaml.safe_load(content) or {}

            return ResolvedSkill(
                name=manifest.get('name', Path(skill_yaml_key).parent.split('/')[-1]),
                manifest=manifest,
                content=content,
                source_url=url,
                is_directory=True,
                files=all_files,
            )
    else:
        # Direct URL (raw content)
        content, _ = fetch_url_content(url)
        return _parse_skill_content(content, url)


def _parse_skill_content(content: str, source_url: str) -> ResolvedSkill:
    """Parse skill content from raw YAML."""
    manifest = yaml.safe_load(content) or {}

    # Extract name from URL or manifest
    name = manifest.get('name')
    if not name:
        # Try to get from URL
        url_path = source_url.split('?')[0].rstrip('/')
        name = Path(url_path).stem
        if name == 'raw':
            name = Path(url_path).parent.stem

    return ResolvedSkill(
        name=name,
        manifest=manifest,
        content=content,
        source_url=source_url,
        is_directory=False,
        files=None,
    )


def install_skill_from_url(
    skill_url: str,
    target_dir: Path,
    skill_name: Optional[str] = None,
) -> Tuple[str, Path]:
    """
    Install a skill from URL to target directory.

    Args:
        skill_url: URL to the skill (file or directory)
        target_dir: Directory to install skill into (.llm-assistant/skills/)
        skill_name: Optional name override

    Returns: (skill_name, path)
    """
    resolved = resolve_skill_from_url(skill_url)

    # Use provided name or from manifest
    final_name = skill_name or resolved.name or 'unknown-skill'
    # Sanitize name for filesystem
    final_name = re.sub(r'[^\w\-_.]', '_', final_name)

    if resolved.is_directory and resolved.files:
        # Install as directory skill
        skill_path = target_dir / final_name
        skill_path.mkdir(parents=True, exist_ok=True)

        # Write all files
        for rel_path, content in resolved.files.items():
            file_path = skill_path / rel_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding='utf-8')

        # Write manifest as skill.yaml
        manifest_path = skill_path / 'skill.yaml'
        manifest_path.write_text(resolved.content, encoding='utf-8')
    else:
        # Install as single file skill
        skill_path = target_dir / f"{final_name}.yaml"

        # Check if file exists (to avoid overwriting without consent)
        if skill_path.exists():
            # Add suffix to make unique
            import datetime
            timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
            skill_path = target_dir / f"{final_name}_{timestamp}.yaml"

        skill_path.write_text(resolved.content, encoding='utf-8')

    return final_name, skill_path


# ── Skill Tools Loading ─────────────────────────────────────────────────────────

class SkillToolLoader:
    """
    Dynamically loads custom tools from skill directories.

    Claude Code skill tools are defined in skill.yaml like:
    ```yaml
    tools:
      - name: my_tool
        description: "A custom tool for..."
        module: my_skill.tools  # Python module path relative to skill dir
        function: run_tool      # Function to call
        parameters:            # OpenAI function format (optional)
          type: object
          properties:
            input:
              type: string
          required: [input]
    ```

    The Python module should define a function that matches, e.g.:
    ```python
    def run_tool(input: str) -> str:
        return f"Processed: {input}"
    ```
    """

    def __init__(self, skills_dir: Path):
        self.skills_dir = skills_dir
        self._loaded_tools: Dict[str, Dict[str, Any]] = {}
        self._tool_functions: Dict[str, callable] = {}

    def load_skill_tools(self, skill_name: str) -> List[Dict[str, Any]]:
        """
        Load tools defined in a skill.

        Returns list of tool definitions in OpenAI function format.
        """
        if skill_name in self._loaded_tools:
            return self._loaded_tools[skill_name]

        tools = []

        # Find skill manifest
        skill_path = self._find_skill(skill_name)
        if not skill_path:
            return tools

        # Load manifest
        if skill_path.is_dir():
            manifest_path = skill_path / 'skill.yaml'
            if not manifest_path.exists():
                manifest_path = skill_path / 'skill.yml'
        else:
            manifest_path = skill_path

        if not manifest_path.exists():
            return tools

        try:
            manifest = yaml.safe_load(manifest_path.read_text(encoding='utf-8')) or {}
        except Exception:
            return tools

        skill_tools = manifest.get('tools', [])
        if not skill_tools:
            return tools

        # Load tool modules and register functions
        for tool_def in skill_tools:
            tool_name = tool_def.get('name')
            tool_module = tool_def.get('module')
            tool_function = tool_def.get('function')
            tool_params = tool_def.get('parameters', {})

            if not tool_name or not tool_module or not tool_function:
                continue

            # Try to load the module
            try:
                if skill_path.is_dir():
                    module_dir = skill_path
                else:
                    # For single-file skills, tools aren't supported
                    continue

                module_path = module_dir / f"{tool_module}.py"
                if not module_path.exists():
                    # Try as relative path
                    module_path = module_dir / tool_module
                    if not module_path.exists() and not str(tool_module).endswith('.py'):
                        module_path = module_dir / f"{tool_module}.py"

                if not module_path.exists():
                    print(f"Tool module not found: {module_path}")
                    continue

                # Load module dynamically
                import importlib.util
                spec = importlib.util.spec_from_file_location(
                    f"skill_tool_{skill_name}_{tool_name}",
                    module_path
                )
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)

                    # Get the function
                    if hasattr(module, tool_function):
                        func = getattr(module, tool_function)
                        self._tool_functions[f"{skill_name}.{tool_name}"] = func

                        # Build tool definition
                        tool_entry = {
                            'type': 'function',
                            'function': {
                                'name': tool_name,
                                'description': tool_def.get('description', ''),
                            }
                        }

                        # Add parameters if provided
                        if tool_params:
                            tool_entry['function']['parameters'] = tool_params
                        else:
                            # Default parameters
                            tool_entry['function']['parameters'] = {
                                'type': 'object',
                                'properties': {},
                                'required': [],
                            }

                        tools.append(tool_entry)

            except Exception as e:
                print(f"Failed to load tool {tool_name} from skill {skill_name}: {e}")

        self._loaded_tools[skill_name] = tools
        return tools

    def get_tool_function(self, skill_name: str, tool_name: str) -> Optional[callable]:
        """Get the callable for a specific tool."""
        key = f"{skill_name}.{tool_name}"
        return self._tool_functions.get(key)

    def _find_skill(self, skill_name: str) -> Optional[Path]:
        """Find the path to a skill."""
        # Check single-file
        for ext in ('.yaml', '.yml'):
            path = self.skills_dir / f"{skill_name}{ext}"
            if path.exists():
                return path

        # Check directory
        dir_path = self.skills_dir / skill_name
        if dir_path.is_dir():
            return dir_path

        return None

    def load_all_skill_tools(self, root_dir: str = "") -> Dict[str, List[Dict[str, Any]]]:
        """
        Load tools from all enabled skills.

        Returns: { skill_name: [tool_definitions] }
        """
        from .workspace_handler import load_skills

        ws_dir = target_dir = Path(root_dir) if root_dir else self.skills_dir.parent
        skills = load_skills(str(ws_dir))

        result = {}
        for skill in skills:
            tools = self.load_skill_tools(skill.name)
            if tools:
                result[skill.name] = tools

        return result


# Global tool loader instance
_tool_loader: Optional[SkillToolLoader] = None


def get_skill_tool_loader(skills_dir: Optional[Path] = None) -> SkillToolLoader:
    """Get the global skill tool loader instance."""
    global _tool_loader
    if _tool_loader is None or skills_dir is not None:
        if skills_dir is None:
            # Default to first .llm-assistant/skills/ found
            skills_dir = Path.cwd() / '.llm-assistant' / 'skills'
        _tool_loader = SkillToolLoader(skills_dir)
    return _tool_loader


# ── Skill Marketplace/Registry ──────────────────────────────────────────────────

# Default Skill Registries (Marketplaces)
DEFAULT_REGISTRIES = {
    "anthropic": {
        "name": "Anthropic Skills",
        "description": "Official Anthropic skills for Claude Code",
        "url": "https://raw.githubusercontent.com/anthropics/skills/main/registry.json",
    },
    "community": {
        "name": "Community Skills",
        "description": "Community-contributed skills",
        "url": "https://raw.githubusercontent.com/claude-code/skills-community/main/registry.json",
    },
}


@dataclass
class RegistrySkill:
    """A skill listed in a marketplace registry."""
    name: str
    description: str
    url: str
    author: str = ""
    tags: List[str] = None
    version: str = ""
    registry: Optional[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class SkillRegistry:
    """A marketplace registry containing multiple skills."""
    id: str
    name: str
    description: str
    url: str
    skills: List[RegistrySkill] = None
    raw_data: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.skills is None:
            self.skills = []


class SkillRegistryClient:
    """
    Client for browsing and installing skills from marketplaces/registries.

    Registry format (JSON):
    {
      "name": "Marketplace Name",
      "description": "Description",
      "skills": [
        {
          "name": "skill-name",
          "description": "...",
          "url": "path/to/skill",
          "author": "...",
          "tags": ["tag1"],
          "version": "1.0.0"
        }
      ]
    }
    """

    def __init__(self):
        self._registries: Dict[str, SkillRegistry] = {}
        self._cache: Dict[str, Tuple[SkillRegistry, Optional[str]]] = {}

        # Register default registries
        for reg_id, reg_info in DEFAULT_REGISTRIES.items():
            self.add_registry(
                id=reg_id,
                url=reg_info['url'],
                name=reg_info['name'],
                description=reg_info['description'],
            )

    def add_registry(self, id: str, url: str, name: str = "", description: str = "") -> None:
        """Add a custom registry to the client."""
        self._registries[id] = SkillRegistry(
            id=id,
            name=name or id,
            description=description,
            url=url,
        )

    def get_registry(self, id: str) -> Optional[SkillRegistry]:
        """Get a registry by ID."""
        return self._registries.get(id)

    def list_registries(self) -> List[SkillRegistry]:
        """List all available registries."""
        return list(self._registries.values())

    async def fetch_registry(self, id: str, force: bool = False) -> Optional[SkillRegistry]:
        """
        Fetch a registry's skill list from its URL.

        Uses ETag caching to avoid unnecessary network requests.
        """
        registry = self._registries.get(id)
        if not registry:
            return None

        # Check cache unless forcing refresh
        cached = self._cache.get(registry.url)
        if cached and not force:
            cached_registry, _ = cached
            registry.skills = cached_registry.skills
            registry.raw_data = cached_registry.raw_data
            return registry

        try:
            content, etag = fetch_url_content(registry.url)
            data = json.loads(content)

            registry.name = data.get('name', registry.name)
            registry.description = data.get('description', registry.description)
            registry.raw_data = data

            skills = []
            for skill_data in data.get('skills', []):
                skill = RegistrySkill(
                    name=skill_data.get('name', ''),
                    description=skill_data.get('description', ''),
                    url=skill_data.get('url', ''),
                    author=skill_data.get('author', ''),
                    tags=skill_data.get('tags', []),
                    version=skill_data.get('version', ''),
                    registry=id,
                )
                skills.append(skill)

            registry.skills = skills
            self._cache[registry.url] = (registry, etag)

            return registry

        except Exception as e:
            print(f"Failed to fetch registry {id}: {e}")
            return None

    def resolve_skill_url(self, registry_id: str, skill_url: str) -> str:
        """
        Resolve a skill URL relative to a registry.

        If the URL is absolute (starts with http), use it directly.
        Otherwise, assume it's relative to the registry's repository.
        """
        if skill_url.startswith('http://') or skill_url.startswith('https://'):
            return skill_url

        registry = self._registries.get(registry_id)
        if not registry:
            raise ValueError(f"Unknown registry: {registry_id}")

        # Get the base repo URL from the registry URL
        base_repo = GitHubURLResolver.get_repo_base(registry.url)
        if not base_repo:
            raise ValueError(f"Cannot determine repository base for registry: {registry.url}")

        # Extract the branch and path from registry URL
        raw_match = re.match(
            r'https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+)',
            registry.url
        )
        if raw_match:
            user, repo, branch, registry_path = raw_match.groups()
            # Get the directory containing the registry
            registry_dir = '/'.join(registry_path.split('/')[:-1])
            if registry_dir:
                skill_path = f"{registry_dir}/{skill_url}"
            else:
                skill_path = skill_url
            return f"https://github.com/{user}/{repo}/tree/{branch}/{skill_path}"

        # Fallback: just append to repo root
        return f"{base_repo}/tree/main/{skill_url}"

    async def install_from_registry(
        self,
        registry_id: str,
        skill_name: str,
        target_dir: Path,
    ) -> Tuple[str, Path]:
        """
        Install a skill from a registry.

        Args:
            registry_id: ID of the registry (e.g., "anthropic")
            skill_name: Name of the skill to install
            target_dir: Directory to install to

        Returns: (skill_name, path)
        """
        registry = await self.fetch_registry(registry_id)
        if not registry:
            raise ValueError(f"Failed to fetch registry: {registry_id}")

        skill = next((s for s in registry.skills if s.name == skill_name), None)
        if not skill:
            raise ValueError(f"Skill '{skill_name}' not found in registry '{registry_id}'")

        skill_url = self.resolve_skill_url(registry_id, skill.url)
        return install_skill_from_url(skill_url, target_dir, skill_name)


# Add get_repo_base to GitHubURLResolver if not present
if not hasattr(GitHubURLResolver, 'get_repo_base'):
    @classmethod
    def get_repo_base(cls, url: str) -> Optional[str]:
        """Extract the base repository URL from a GitHub URL."""
        patterns = [
            cls.TREE_PATTERN,
            cls.BLOB_PATTERN,
            cls.BLOB_DIR_PATTERN,
        ]

        for pattern in patterns:
            match = pattern.match(url)
            if match:
                user, repo = match.groups()[:2]
                return f"https://github.com/{user}/{repo}"

        # Try raw URL
        raw_match = cls.RAW_PATTERN.match(url)
        if raw_match:
            user, repo = raw_match.groups()[:2]
            return f"https://github.com/{user}/{repo}"

        return None

    GitHubURLResolver.get_repo_base = get_repo_base


# Global registry client instance
_registry_client: Optional[SkillRegistryClient] = None


def get_registry_client() -> SkillRegistryClient:
    """Get the global registry client."""
    global _registry_client
    if _registry_client is None:
        _registry_client = SkillRegistryClient()
    return _registry_client
