#!/bin/bash
# Hook: SessionStart - 종합 업데이트 체크
# 플러그인, 템플릿, 글로벌 스킬, MCP 서버 전체 확인
source "$(dirname "$0")/_harness-common.sh"

harness_set_cwd
harness_ensure_state_dir

# 플러그인 루트 경로 확인
PLUGIN_ROOT=""
if [ -f ".harness/plugin-root" ]; then
    PLUGIN_ROOT=$(cat ".harness/plugin-root" 2>/dev/null)
fi

if [ -z "$PLUGIN_ROOT" ] || [ ! -d "$PLUGIN_ROOT" ]; then
    exit 0
fi

# 캐시 확인 (24시간 유효)
CACHE_FILE="$HARNESS_STATE_DIR/update-check-cache"
if [ -f "$CACHE_FILE" ]; then
    CACHE_TS=$(head -1 "$CACHE_FILE" 2>/dev/null)
    NOW=$(date +%s)
    if [ -n "$CACHE_TS" ] && [ $((NOW - CACHE_TS)) -lt 86400 ]; then
        CACHED=$(tail -n +2 "$CACHE_FILE" 2>/dev/null)
        if [ -n "$CACHED" ] && [ "$CACHED" != "up-to-date" ]; then
            echo "$CACHED"
        fi
        exit 0
    fi
fi

# 환경변수 export (python3에서 사용)
export PLUGIN_ROOT
export CWD

# 종합 업데이트 체크 (python3)
RESULT=$(python3 << 'PYEOF'
import json, subprocess, sys, os, hashlib
from pathlib import Path

plugin_root = os.environ.get('PLUGIN_ROOT', '')
project_root = os.environ.get('CWD', os.getcwd())
home = os.path.expanduser('~')

sections = []

def file_md5(path):
    try:
        with open(path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except:
        return None

def semver_newer(current, remote):
    """remote가 current보다 새 버전이면 True"""
    try:
        cv = list(map(int, current.split('.')[:3]))
        rv = list(map(int, remote.split('.')[:3]))
        for i in range(3):
            c = cv[i] if i < len(cv) else 0
            r = rv[i] if i < len(rv) else 0
            if r > c:
                return True
            elif r < c:
                return False
        return False
    except:
        return False

def git_check_version(repo_path, branch='main'):
    """git repo의 로컬 vs 원격 버전 비교. (current, remote, needs_update) 반환"""
    try:
        subprocess.check_output(
            ['git', '-C', repo_path, 'rev-parse', '--is-inside-work-tree'],
            stderr=subprocess.DEVNULL
        )
    except:
        return None, None, False

    try:
        subprocess.check_output(
            ['git', '-C', repo_path, 'fetch', 'origin'],
            stderr=subprocess.DEVNULL, timeout=10
        )
    except:
        return None, None, False

    try:
        with open(os.path.join(repo_path, 'package.json')) as f:
            current = json.load(f).get('version', '0.0.0')
    except:
        current = '0.0.0'

    remote = '0.0.0'
    for b in [branch, 'main', 'master']:
        try:
            raw = subprocess.check_output(
                ['git', '-C', repo_path, 'show', f'origin/{b}:package.json'],
                stderr=subprocess.DEVNULL
            ).decode()
            remote = json.loads(raw).get('version', '0.0.0')
            break
        except:
            continue

    return current, remote, semver_newer(current, remote)

# ═══════════════════════════════════
# 1. 플러그인 자체 체크
# ═══════════════════════════════════
def check_plugin():
    if not plugin_root or not os.path.isdir(plugin_root):
        return None

    current, remote, needs = git_check_version(plugin_root)
    if not needs:
        return None

    lines = [f'  현재: v{current} → 최신: v{remote}']
    lines.append(f'  실행: harness_update(projectRoot: "{project_root}", updatePlugin: true)')

    try:
        log = subprocess.check_output(
            ['git', '-C', plugin_root, 'log', 'HEAD..origin/main', '--oneline'],
            stderr=subprocess.DEVNULL
        ).decode().strip()
        entries = [e for e in log.split('\n')[:5] if e]
        if entries:
            lines.append('  변경사항:')
            for e in entries:
                lines.append(f'    - {e}')
    except:
        pass

    return '\n'.join(lines)

# ═══════════════════════════════════
# 2. 템플릿 체크
# ═══════════════════════════════════
def check_templates():
    config_path = os.path.join(project_root, 'carpdm-harness.config.json')
    manifest_path = os.path.join(plugin_root, 'templates', 'module-manifest.json')

    if not os.path.exists(config_path) or not os.path.exists(manifest_path):
        return None

    try:
        with open(config_path) as f:
            config = json.load(f)
        with open(manifest_path) as f:
            manifest = json.load(f)
    except:
        return None

    templates_dir = os.path.join(plugin_root, 'templates')
    modules = config.get('modules', [])
    changed = []

    for mod_name in modules:
        mod = manifest.get('modules', {}).get(mod_name, {})
        for file_type in ['hooks', 'commands', 'docs', 'agentFiles', 'rules', 'agents']:
            for entry in mod.get(file_type, []):
                src = os.path.join(templates_dir, entry['source'])
                dest = os.path.join(project_root, entry['destination'])

                if not os.path.exists(src) or not os.path.exists(dest):
                    continue

                src_hash = file_md5(src)
                dest_hash = file_md5(dest)
                if src_hash and dest_hash and src_hash != dest_hash:
                    changed.append(entry['destination'])

    if not changed:
        return None

    lines = [f'  {len(changed)}개 파일 변경 감지:']
    for c in changed[:10]:
        lines.append(f'    - {c}')
    if len(changed) > 10:
        lines.append(f'    ... 외 {len(changed) - 10}개')
    lines.append(f'  실행: harness_update(projectRoot: "{project_root}", acceptAll: true)')
    return '\n'.join(lines)

# ═══════════════════════════════════
# 3. 글로벌 스킬(커맨드) 체크
# ═══════════════════════════════════
def check_skills():
    global_dir = os.path.join(home, '.claude', 'commands')
    templates_global = os.path.join(plugin_root, 'templates', 'global')

    if not os.path.isdir(global_dir) or not os.path.isdir(templates_global):
        return None

    changed = []
    for f in os.listdir(templates_global):
        if not f.endswith('.md'):
            continue
        src = os.path.join(templates_global, f)
        dest = os.path.join(global_dir, f)

        if not os.path.exists(dest):
            continue

        src_hash = file_md5(src)
        dest_hash = file_md5(dest)
        if src_hash and dest_hash and src_hash != dest_hash:
            changed.append(f)

    if not changed:
        return None

    lines = [f'  {len(changed)}개 스킬 변경 감지:']
    for c in changed:
        lines.append(f'    - ~/.claude/commands/{c}')
    lines.append(f'  실행: harness_init(projectRoot: "{project_root}", installGlobal: true)')
    return '\n'.join(lines)

# ═══════════════════════════════════
# 4. MCP 서버 체크
# ═══════════════════════════════════
def check_mcp_servers():
    mcp_paths = [
        os.path.join(project_root, '.mcp.json'),
        os.path.join(home, '.claude', '.mcp.json'),
    ]

    servers = {}
    for mp in mcp_paths:
        if not os.path.exists(mp):
            continue
        try:
            with open(mp) as f:
                data = json.load(f)
            for name, cfg in data.get('mcpServers', {}).items():
                if name not in servers and name != 'carpdm-harness':
                    servers[name] = cfg
        except:
            continue

    if not servers:
        return None

    updates = []
    for name, cfg in servers.items():
        args = cfg.get('args', [])

        # 서버 경로 추출: args에서 절대 경로를 가진 파일 찾기
        server_path = None
        for arg in args:
            if not isinstance(arg, str) or not os.path.isabs(arg):
                continue
            candidate = os.path.dirname(arg)
            # dist/, build/, out/ 안에 있으면 상위로
            while candidate and os.path.basename(candidate) in ('dist', 'build', 'out', 'bin'):
                candidate = os.path.dirname(candidate)
            if os.path.isdir(candidate) and os.path.exists(os.path.join(candidate, 'package.json')):
                server_path = candidate
                break

        if not server_path:
            continue

        current, remote, needs = git_check_version(server_path)
        if needs:
            updates.append(f'    - {name}: v{current} → v{remote}')

    if not updates:
        return None

    lines = [f'  {len(updates)}개 서버 업데이트 가능:']
    lines.extend(updates)
    return '\n'.join(lines)

# ═══════════════════════════════════
# 실행
# ═══════════════════════════════════
plugin_result = check_plugin()
if plugin_result:
    sections.append(f'[플러그인]\n{plugin_result}')

template_result = check_templates()
if template_result:
    sections.append(f'[템플릿]\n{template_result}')

skill_result = check_skills()
if skill_result:
    sections.append(f'[글로벌 스킬]\n{skill_result}')

mcp_result = check_mcp_servers()
if mcp_result:
    sections.append(f'[MCP 서버]\n{mcp_result}')

if sections:
    print('[carpdm-harness 업데이트 체크]')
    print()
    print('\n\n'.join(sections))
else:
    print('__UP_TO_DATE__')
PYEOF
)

# 결과 처리
if [ -z "$RESULT" ] || echo "$RESULT" | grep -q '__UP_TO_DATE__'; then
    echo "$(date +%s)" > "$CACHE_FILE" 2>/dev/null
    echo "up-to-date" >> "$CACHE_FILE" 2>/dev/null
    exit 0
fi

# 캐시 저장
echo "$(date +%s)" > "$CACHE_FILE" 2>/dev/null
echo "$RESULT" >> "$CACHE_FILE" 2>/dev/null

echo "$RESULT"
exit 0
