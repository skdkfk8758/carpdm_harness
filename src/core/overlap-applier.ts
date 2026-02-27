/**
 * 중복 적용 로직
 *
 * 사용자의 OverlapChoices를 받아 실제 변경(allow/deny 조작, 파일 삭제 등)을 수행합니다.
 */

import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { OverlapScanResult, OverlapChoices, OverlapAction, ApplyResult, ApplyDetail } from '../types/overlap.js';
import { modifyPermissionRules } from './settings-bootstrap.js';

/**
 * 스캔 결과 + 사용자 선택에 따라 중복 항목을 처리합니다.
 */
export function applyOverlapChoices(
  projectRoot: string,
  scanResult: OverlapScanResult,
  choices: OverlapChoices,
): ApplyResult {
  const details: ApplyDetail[] = [];
  let applied = 0;
  let skipped = 0;
  const errors: string[] = [];

  // applyDefaults: 모든 항목에 권장 액션 적용
  const decisions = choices.applyDefaults
    ? Object.fromEntries(scanResult.items.map(i => [i.id, i.recommended]))
    : choices.decisions ?? {};

  for (const item of scanResult.items) {
    const action: OverlapAction = decisions[item.id] ?? 'keep';

    if (action === 'keep') {
      skipped++;
      details.push({
        overlapId: item.id,
        action: 'keep',
        success: true,
        message: `${item.title}: 유지`,
      });
      continue;
    }

    try {
      if (action === 'disable') {
        // allow에서 제거 + deny에 추가
        const ops = item.affectedItems.map(rule => ({
          rule,
          from: 'allow' as const,
          to: 'deny' as const,
        }));
        modifyPermissionRules(projectRoot, ops);
        applied++;
        details.push({
          overlapId: item.id,
          action: 'disable',
          success: true,
          message: `${item.title}: ${item.affectedItems.length}개 도구 비활성화`,
        });
      } else if (action === 'delete') {
        if (item.category === 'empty-rules') {
          // 빈 규칙 파일 삭제
          let deleted = 0;
          for (const filePath of item.affectedItems) {
            const fullPath = join(projectRoot, filePath);
            if (existsSync(fullPath)) {
              unlinkSync(fullPath);
              deleted++;
            }
          }
          applied++;
          details.push({
            overlapId: item.id,
            action: 'delete',
            success: true,
            message: `${item.title}: ${deleted}개 파일 삭제`,
          });
        } else if (item.category === 'bloated-permissions') {
          // 중복 allow 항목 제거 (deny 추가 안 함)
          const ops = item.affectedItems.map(rule => ({
            rule,
            from: 'allow' as const,
          }));
          modifyPermissionRules(projectRoot, ops);
          applied++;
          details.push({
            overlapId: item.id,
            action: 'delete',
            success: true,
            message: `${item.title}: ${item.affectedItems.length}개 중복 항목 제거`,
          });
        }
      }
    } catch (err) {
      const message = `${item.title} 처리 실패: ${String(err)}`;
      errors.push(message);
      details.push({
        overlapId: item.id,
        action,
        success: false,
        message,
      });
    }
  }

  return { applied, skipped, errors, details };
}
