import Link from "next/link";
import { Icon, type IconName } from "./icon";
export function ProfileMenuItem({
  href,
  icon,
  label,
  detail,
}: {
  href: string;
  icon: IconName;
  label: string;
  detail?: string;
}) {
  return (
    <Link href={href} className="profile-menu-item">
      <span className="menu-icon">
        <Icon name={icon} size={21} />
      </span>
      <div>
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </div>
      <Icon name="chevron" size={20} />
    </Link>
  );
}
