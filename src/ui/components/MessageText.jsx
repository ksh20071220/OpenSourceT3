/*
 * MessageText.jsx — 대화 말풍선 안의 글
 * [담당: 곽수호]
 *
 * *별표로 감싼 부분*은 행동·상황 묘사로 보고 기울임 + 흐린 색으로 보여 준다 (캐릭터 채팅에서 흔한 표기).
 */
export function MessageText({ text }) {
  const parts = String(text || '').split(/(\*[^*\n]+\*)/g)
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^\*[^*\n]+\*$/.test(part) ? (
          <em key={i} className="opacity-70">
            {part.slice(1, -1)}
          </em>
        ) : (
          part
        ),
      )}
    </span>
  )
}
