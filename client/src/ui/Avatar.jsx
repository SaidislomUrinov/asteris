import { getAvatarColor, getInitials } from "../utils/avatar";
import { API } from "../utils/fetching";

/**
 * Avatar component
 *
 * @param {Object} props
 * @param {{_id?: string, name?: string, lastName?: string, avatar?: string}} props.user
 * @param {number} [props.size=40] - Avatar o'lchami (px)
 * @param {string} [props.className]
 */
function Avatar({ user = {}, size = 40, className = "" }) {
  const { _id, name, lastName, avatar } = user || {};

  if (avatar) {
    return (
      <img
        src={avatar.startsWith("http") ? avatar : `${API}${avatar}`}
        alt={name || "avatar"}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  const bg = getAvatarColor(_id || name);
  const initials = getInitials(name, lastName);

  return (
    <div
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.4 }}
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none ${className}`}
    >
      {initials}
    </div>
  );
}

export default Avatar;
