import { HiArrowPath } from "react-icons/hi2";
import { getAvatarColor, getInitials } from "../utils/avatar";
import { photoSrc } from "../utils/studentPhoto";

/**
 * Avatar component
 *
 * @param {Object} props
 * @param {{_id?: string, name?: string, lastName?: string, avatar?: string}} props.user
 * @param {number} [props.size=40] - Avatar o'lchami (px)
 * @param {boolean} [props.busy] - rasm yuklanmoqda — ustida spinner (o'lcham o'zgarmaydi)
 * @param {string} [props.className]
 */
function Avatar({ user = {}, size = 40, busy = false, className = "" }) {
  const { _id, name, lastName, avatar } = user || {};

  const bg = getAvatarColor(_id || name);
  const initials = getInitials(name, lastName);

  const face = avatar ? (
    <img
      src={photoSrc(avatar)}
      alt={name || "avatar"}
      style={{ width: size, height: size }}
      className={`rounded-full object-cover shrink-0 ${className}`}
    />
  ) : (
    <div
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.4 }}
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none ${className}`}
    >
      {initials}
    </div>
  );

  if (!busy) return face;

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {face}
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/45 text-white">
        <HiArrowPath className="animate-spin" style={{ fontSize: Math.max(14, size * 0.4) }} />
      </span>
    </span>
  );
}

export default Avatar;
