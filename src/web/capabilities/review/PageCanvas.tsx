import type { PageReadingResponse } from '../../../contracts/review.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { colourOf, dashOf, groupOf, roleLabel } from './unit-roles.js';

type ReadPage = PageReadingResponse['pages'][number];
type Unit = ReadPage['units'][number];

interface PageCanvasProps {
  page: ReadPage;
  /** The role each unit has now: the saved one, or the owner's unsaved change. */
  roleOf(unit: Unit): string;
  selected: string | null;
  onSelect(unitId: string): void;
}

/**
 * One page as the import read it (Q26): the page picture with every unit outlined in its role's
 * colour, in the page's own points. A unit the owner may change is a button.
 */
export function PageCanvas({ page, roleOf, selected, onSelect }: PageCanvasProps) {
  const { t } = useI18n();
  return (
    <svg
      viewBox={`0 0 ${page.width} ${page.height}`}
      width="100%"
      role="img"
      aria-label={`${t('editor.pageReading.page')} ${page.page}`}
    >
      {page.imageUrl && (
        <image href={page.imageUrl} x={0} y={0} width={page.width} height={page.height} />
      )}
      {page.units.map((unit) => {
        const role = roleOf(unit);
        const group = groupOf(role, unit.editable);
        const box = unit.box;
        return (
          <rect
            key={unit.unitId}
            data-unit={unit.unitId}
            data-role={role}
            x={box.x0}
            y={box.y0}
            width={Math.max(1, box.x1 - box.x0)}
            height={Math.max(1, box.y1 - box.y0)}
            fill="transparent"
            stroke={colourOf(group)}
            strokeWidth={selected === unit.unitId ? 4 : 2}
            strokeDasharray={dashOf(unit.kind, group)}
            vectorEffect="non-scaling-stroke"
            {...(unit.editable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `${roleLabel(t, role)}: ${unit.text ?? t('editor.pageReading.picture')}`,
                  'aria-pressed': selected === unit.unitId,
                  onClick: () => onSelect(unit.unitId),
                  onKeyDown: (event: { key: string }) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelect(unit.unitId);
                  },
                }
              : {})}
          />
        );
      })}
    </svg>
  );
}
