/*
 * Avatar.jsx — 캐릭터 프로필 (이름 첫 글자 + 이름으로 정해지는 색)
 * [담당: 곽수호]
 *
 * 저작권 때문에 원작 이미지를 쓰지 않고, 이름에서 색을 뽑아 만든다.
 * TODO(곽수호): 사용자가 직접 그린/가진 이미지를 올려 프로필로 쓰기 (브라우저에만 저장)
 */

function hash(s) {
  let h = 0
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) | 0
  return Math.abs(h)
}

export function avatarColors(name) {
  const h = hash(name)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h % 60)) % 360
  return `linear-gradient(135deg, oklch(0.72 0.13 ${hue1}), oklch(0.55 0.15 ${hue2}))`
}

const SIZES = {
  sm: 'size-9 text-sm',
  md: 'size-12 text-lg',
  lg: 'size-20 text-3xl',
  card: 'aspect-[4/5] w-full text-5xl',
}

export function Avatar({ name, size = 'md', className = '' }) {
  const first = Array.from(String(name || '?').trim())[0] || '?'
  const rounded = size === 'card' ? 'rounded-2xl' : 'rounded-full'
  return (
    <div
      className={`flex shrink-0 select-none items-center justify-center font-bold text-white ${rounded} ${SIZES[size]} ${className}`}
      style={{ background: avatarColors(name) }}
      aria-hidden="true"
    >
      <span className="drop-shadow-sm">{first}</span>
    </div>
  )
}
