import { useI18n } from '../../platform/i18n/i18n.js';
import { colourOf, GROUP_KEYS, ROLE_GROUPS, type RoleGroup } from './unit-roles.js';

/** A swatch in the role's colour: filled for text, a dashed square for a picture. */
const swatch = (group: RoleGroup, picture: boolean) => (
  <span aria-hidden="true" style={{ color: colourOf(group) }}>
    {picture ? '⬚' : '■'}
  </span>
);

/** What each outline colour means; a dashed outline is a picture (Q26). */
export function RoleLegend() {
  const { t } = useI18n();
  return (
    <ul className="qb-list" aria-label={t('editor.pageReading.legend')}>
      {ROLE_GROUPS.map((group) => (
        <li key={group} className="qb-list__item">
          {swatch(group, false)} {t(GROUP_KEYS[group])}
        </li>
      ))}
      <li className="qb-list__item">
        {swatch('stem', true)} {t('editor.pageReading.picture')}
      </li>
    </ul>
  );
}
